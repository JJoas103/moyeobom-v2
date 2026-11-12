import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Field from '../common/Field'
import MetaLine from '../common/MetaLine'
import ErrorMessage from '../ErrorMessage'
import CreateSteps from './CreateSteps'
import EventFacts from './EventFacts'
import CardPreview from './CardPreview'
import MeetupStatusActions from './MeetupStatusActions'
import { createMeetup, updateMeetup, uploadMeetupImage } from '../../data/meetups'
import { BUDGETS } from '../../data/constants'
import { assetUrl } from '../../utils/asset'
import { ClockIcon, LockIcon } from '../common/Icons'
import { eventStatus, watchApplyOpen } from '../../utils/status'
import { formatMeetupWhen, formatMonthDay, formatTime, formatWeekday } from '../../utils/format'
import { canOpenMeetup, estimateEndText } from '../../utils/event'
import { fromLocalInput, toLocalInput } from '../../utils/datetime'
import { guessArea, suggestDraft } from '../../utils/meetupDraft'
import { bandsOn, parseSessions } from '../../utils/sessions'
import { fetchNearby } from '../../data/nearby'
import PlaceSearch from './PlaceSearch'
import TimelineEditor from './TimelineEditor'
import { TIMELINE_HOURS, TIMELINE_TITLE_MAX, rowAt } from '../../utils/timeline'

// FullCalendar 가 무거워서 만들기 · 수정 화면에 들어올 때만 받는다
const TalkCalendar = lazy(() => import('./TalkCalendar'))

const TITLE_MAX = 40
const INTRO_MAX = 200
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const IMAGE_MAX = 20 * 1024 * 1024 // 백엔드 config/upload.js uploadMeetup 과 같게
const CAPACITIES = [2, 3, 4, 5, 6, 7, 8, 9, 10]

// 만들기 ②~④ (① 행사 고르기는 CreatePick). 수정 화면은 같은 순서로 한 페이지에 펼친다
// fields 는 validate · 서버 fieldErrors 의 키 — '다음'은 그 스텝 칸만 보고, 제출 오류는 그 칸이 있는 스텝으로 돌아간다
const STEPS = [
  {
    key: 'intro',
    title: '소개 · 조건',
    desc: '목록에 먼저 보이는 정보',
    fields: ['title', 'intro', 'image', 'budget', 'capacity'],
  },
  {
    key: 'when',
    title: '언제',
    desc: '관람 동행 여부 · 이야기 자리 시각',
    fields: ['watch', 'talkStart'],
  },
  {
    key: 'where',
    title: '어디서 · 타임라인',
    desc: '장소 · 동네 · 그날의 순서',
    fields: ['place', 'area', 'timeline'],
  },
]

const pickErrors = (errs, keys) => Object.fromEntries(Object.entries(errs).filter(([k, v]) => v && keys.includes(k)))

/** 오류가 난 칸이 있는 첫 스텝 (모르는 키면 마지막 스텝) */
function stepWithError(errs) {
  const i = STEPS.findIndex((s) => s.fields.some((k) => errs[k]))
  return i < 0 ? STEPS.length - 1 : i
}

function initialForm(event, meetup) {
  const s = suggestDraft(event)
  const ended = eventStatus(event).tone === 'closed'
  // 수정 — 저장된 값 그대로 (제안 문구는 띄우지 않는다)
  if (meetup) {
    const { talk, watch } = meetup
    return {
      title: meetup.title,
      intro: meetup.intro || '',
      talkStart: toLocalInput(talk.startAt),
      place: talk.place || '',
      address: talk.address || '',
      location: talk.location?.lat ? talk.location : null,
      area: talk.area,
      timeline: (meetup.timeline || []).map((r) => ({ time: formatTime(r.at), title: r.title })),
      areaTouched: true,
      alcohol: meetup.alcohol,
      budget: meetup.budget,
      capacity: meetup.capacity,
      watchEnabled: Boolean(watch?.enabled) && !ended,
    }
  }
  return {
    title: '',
    intro: '',
    talkStart: toLocalInput(s.talkStart),
    place: '',
    address: '',
    location: null,
    area: '',
    timeline: [], // [{ time: 'HH:MM', title }] — TimelineEditor
    areaTouched: false,
    alcohol: false,
    budget: '1to2',
    capacity: 4,
    watchEnabled: !ended, // 끝난 행사는 이야기 자리만
  }
}

/** 시각 칸 아래 한 줄 — 고른 날 · 시각을 다시 읽어 준다 '11.15 (일) 20:40' */
function talkStartHint(form) {
  const at = fromLocalInput(form.talkStart)
  return at ? `${formatMonthDay(at)} (${formatWeekday(at)}) ${formatTime(at)}` : null
}

/** 고른 날의 행사 시간 — '회차 시간 19:00–20:30' (전시 · 축제는 '운영 시간') */
function dayBandsText(event, date) {
  if (!date) return ''
  const what = event.runType === 'period' ? '운영 시간' : '회차 시간'
  const labels = bandsOn(parseSessions(event.sessionsText), event, date).map((b) => b.label.replace(' 회차', ''))
  return labels.length ? `${what} ${labels.join(' · ')}` : `${what} 없음`
}

function validate(form) {
  const e = {}
  const now = new Date()
  const title = form.title.trim()
  if (!title) e.title = '모임 제목을 적어 주세요.'
  else if (title.length > TITLE_MAX) e.title = `${TITLE_MAX}자 안으로 줄여 주세요.`
  if (form.intro.length > INTRO_MAX) e.intro = `${INTRO_MAX}자 안으로 줄여 주세요.`

  const start = fromLocalInput(form.talkStart)
  if (!start) e.talkStart = '이야기 자리 시각을 골라 주세요.'
  else if (start <= now) e.talkStart = '지금보다 뒤의 시각으로 골라 주세요.'
  // 행사 시간으로 막지 않는다 — 달력은 보여 주기만 하고 호스트가 고른다

  if (!form.place.trim()) e.place = '만날 장소를 찾아 주세요.'
  if (!form.area.trim()) e.area = '목록에 보일 동네를 적어 주세요.'

  // 타임라인 — 서버 meetupService.buildMeetup 과 같은 규칙
  if (start) {
    const limit = start.getTime() + TIMELINE_HOURS * 60 * 60 * 1000
    const bad = form.timeline.findIndex((r) => {
      const at = rowAt(start, r.time)
      const t = r.title.trim()
      return !t || t.length > TIMELINE_TITLE_MAX || !at || at.getTime() > limit
    })
    if (bad >= 0) {
      const r = form.timeline[bad]
      const t = r.title.trim()
      e.timeline = !r.time
        ? `${bad + 1}번째 줄 시간을 골라 주세요.`
        : !t
        ? `${bad + 1}번째 줄에 할 일을 적어 주세요.`
        : t.length > TIMELINE_TITLE_MAX
          ? `${bad + 1}번째 줄을 ${TIMELINE_TITLE_MAX}자 안으로 줄여 주세요.`
          : `${bad + 1}번째 줄은 이야기 자리 시작 뒤 ${TIMELINE_HOURS}시간 안으로 골라 주세요.`
    }
  }
  return e
}

/**
 * 모임 정보 폼 — 만들기 ② · 수정 같이 사용
 * meetup 이 있으면 수정 모드 (행사는 못 바꿈 · 아래에 모집 마감 · 모임 취소)
 */
export default function MeetupForm({ event, meetup }) {
  const editing = Boolean(meetup)
  const navigate = useNavigate()
  const formRef = useRef(null)
  const [form, setForm] = useState(() => initialForm(event, meetup))
  const [step, setStep] = useState(0) // 만들기 — STEPS 차례 (수정은 쓰지 않음)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [image, setImage] = useState(null) // 새로 고른 사진 { file, url }
  const [savedImage, setSavedImage] = useState(meetup?.imageUrl || '') // 수정 — 이미 올린 사진 경로
  const ended = eventStatus(event).tone === 'closed'
  const openable = editing || canOpenMeetup(event)
  const minCapacity = Math.max(2, meetup?.approvedCount || 0) // 승인된 인원보다 적게 못 줄임
  const backTo = editing ? `/meetup/${meetup._id}` : `/event/${event._id}`

  // 미리보기용 object URL 정리 (제출 때 파일은 서버에 따로 업로드)
  useEffect(
    () => () => {
      if (image?.url) URL.revokeObjectURL(image.url)
    },
    [image],
  )

  // 스텝을 넘기면 맨 위부터 — 중괄호 필수 (scrollTo 가 Promise 를 돌려주는 브라우저 · member/JoinSteps.jsx 참고)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  const focusFirstError = () => requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus())

  // 만들기 '다음' — 지금 스텝 칸만 확인
  const next = (e) => {
    e.preventDefault()
    const found = pickErrors(validate(form), STEPS[step].fields)
    setErrors((x) => ({ ...x, ...found }))
    if (Object.keys(found).length > 0) return focusFirstError()
    setStep(step + 1)
  }

  const set = (key, value) => {
    setForm((f) => {
      const next = { ...f, [key]: value }
      if (key === 'area') next.areaTouched = true
      return next
    })
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  // 이야기 자리 시각 — 날짜(달력)와 시각(입력칸)을 따로 바꾼다. 폼 값은 'YYYY-MM-DDTHH:mm' 하나
  const setTalkDate = (d) => set('talkStart', `${toLocalInput(d).slice(0, 10)}T${form.talkStart.slice(11, 16) || '19:00'}`)
  const setTalkTime = (t) => t && set('talkStart', `${form.talkStart.slice(0, 10)}T${t}`)

  // 장소 — PlaceSearch 가 { place, address, location, lotAddress? } 를 준다.
  // '목록에 보일 동네'는 직접 고치기 전까지 자동: 좌표가 있으면 가장 가까운 역(GET /api/nearby),
  // 역이 멀면 지번 주소의 동 이름, 직접 입력이면 이름 속 '○○역'
  const placeSeq = useRef(0)
  const setPlace = ({ place, address = '', location = null, lotAddress }) => {
    const seq = ++placeSeq.current
    setForm((f) => ({
      ...f,
      place,
      address,
      location,
      area: f.areaTouched ? f.area : location ? f.area : guessArea(place),
    }))
    if (errors.place) setErrors((e) => ({ ...e, place: undefined }))
    if (!location) return
    const dong = lotAddress?.split(' ').find((w) => /[동가리]$/.test(w))
    fetchNearby(location)
      .then(({ stations }) => stations[0]?.name)
      .catch(() => null)
      .then((station) => {
        const guess = station ? `${station} 근처` : dong ? `${dong} 근처` : ''
        // 그 사이 다른 장소를 골랐거나 동네를 직접 고쳤으면 덮지 않는다
        if (seq === placeSeq.current) setForm((f) => (f.areaTouched ? f : { ...f, area: guess }))
      })
  }

  const onImage = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일을 다시 골라도 onChange 가 오도록
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type)) return setErrors((x) => ({ ...x, image: 'JPG, PNG, WEBP 사진만 올릴 수 있어요.' }))
    if (file.size > IMAGE_MAX) return setErrors((x) => ({ ...x, image: '20MB 이하 사진만 올릴 수 있어요.' }))
    setErrors((x) => ({ ...x, image: undefined }))
    setImage({ file, url: URL.createObjectURL(file) })
  }

  const submit = async (e) => {
    e.preventDefault()
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      // 첫 오류 칸으로 이동 (만들기는 그 칸이 있는 스텝으로 먼저)
      if (!editing) setStep(stepWithError(found))
      focusFirstError()
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    // 사진 먼저 업로드 → 받은 경로 사용 (수정에서 새 사진이 없으면 원래 사진)
    let imageUrl = savedImage
    if (image) {
      try {
        imageUrl = await uploadMeetupImage(image.file)
      } catch (err) {
        setErrors((x) => ({ ...x, image: err.fieldErrors?.image || err.message }))
        setSubmitting(false)
        return
      }
    }

    const talkStart = fromLocalInput(form.talkStart)
    const body = {
      event: event._id,
      title: form.title.trim(),
      intro: form.intro.trim(),
      imageUrl,
      talk: {
        startAt: talkStart.toISOString(),
        place: form.place.trim(),
        address: form.address,
        location: form.location,
        area: form.area.trim(),
      },
      timeline: form.timeline.map((r) => ({ at: rowAt(talkStart, r.time).toISOString(), title: r.title.trim() })),
      alcohol: form.alcohol,
      budget: form.budget,
      capacity: Number(form.capacity),
      // 관람 동행은 받을지 말지만 — 회차는 승인 뒤 채팅에서 정한다
      watch: { enabled: form.watchEnabled },
    }

    try {
      if (editing) {
        await updateMeetup(meetup._id, body)
        navigate(`/meetup/${meetup._id}`, { state: { updated: true } })
      } else {
        const created = await createMeetup(body)
        navigate(`/meetup/${created._id}`, { state: { created: true } })
      }
    } catch (err) {
      if (err.fieldErrors) {
        setErrors(err.fieldErrors)
        if (!editing) setStep(stepWithError(err.fieldErrors))
      }
      setSubmitError(err.message)
      setSubmitting(false)
    }
  }

  const talkStartDate = fromLocalInput(form.talkStart)

  if (!openable) {
    return (
      <ErrorMessage
        title="모임을 열 수 없는 행사"
        message="끝난 지 오래된 행사예요. 다른 행사를 골라 주세요."
      />
    )
  }

  // ---------- ② 소개 · 조건 ----------
  const introSection = (
    <>
      <div className="form-stack">
        <Field label="모임 제목" error={errors.title} count={[form.title.length, TITLE_MAX]}>
          <input
            className="input"
            value={form.title}
            maxLength={TITLE_MAX + 10}
            placeholder="예: 커튼콜 끝나고 넘버 얘기해요"
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>

        <Field label="한두 줄 소개" optional error={errors.intro} count={[form.intro.length, INTRO_MAX]}>
          <textarea
            className="input input--area"
            value={form.intro}
            rows={3}
            placeholder="예: 각자 보고 넘버 얘기만 해요. 처음 오셔도 괜찮아요."
            onChange={(e) => set('intro', e.target.value)}
          />
        </Field>

        <div className="field">
          <span className="field__label">
            모임 대표 이미지<span className="field__optional">선택</span>
          </span>
          <div className="image-pick">
            <div className="image-pick__preview">
              <CardPreview event={event} imageUrl={image?.url || assetUrl(savedImage)} startAt={talkStartDate} />
              <span>카드 미리보기</span>
            </div>
            <label className="image-pick__drop">
              <input type="file" accept={IMAGE_TYPES.join(',')} className="sr-only" onChange={onImage} />
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="9" cy="10" r="2" />
                <path d="M21 16l-5-5-9 9" />
              </svg>
              <strong>{image || savedImage ? '다른 사진으로 바꾸기' : '사진 올리기'}</strong>
              <span>JPG · PNG · 세로 3:4</span>
            </label>
          </div>
          <div className="field__foot">
            {errors.image ? (
              <span className="field__error" role="alert">
                {errors.image}
              </span>
            ) : (
              <span className="field__hint">
                {image || savedImage ? (
                  <>
                    {image ? image.file.name : '지금 쓰는 사진'} ·{' '}
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => (image ? setImage(null) : setSavedImage(''))}
                    >
                      사진 빼기
                    </button>
                  </>
                ) : (
                  '없으면 행사 포스터 사용'
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      <fieldset className="form-group">
        <legend>조건</legend>
        <div className="form-grid form-grid--3">
          <div className="field">
            <span className="field__label" id="alcohol-label">
              술
            </span>
            <div className="pill-radios" role="radiogroup" aria-labelledby="alcohol-label">
              {[
                [false, '없음'],
                [true, '있음'],
              ].map(([v, label]) => (
                <label key={label} className={`pill-radio${form.alcohol === v ? ' is-selected' : ''}`}>
                  <input type="radio" name="alcohol" className="sr-only" checked={form.alcohol === v} onChange={() => set('alcohol', v)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <Field label="대략 예산">
            <select className="input" value={form.budget} onChange={(e) => set('budget', e.target.value)}>
              {BUDGETS.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="정원"
            error={errors.capacity}
            hint={editing && meetup.approvedCount > 0 ? `승인한 ${meetup.approvedCount}명 이상만 가능` : '호스트 제외'}
          >
            <select className="input" value={form.capacity} onChange={(e) => set('capacity', Number(e.target.value))}>
              {CAPACITIES.filter((n) => n >= minCapacity).map((n) => (
                <option key={n} value={n}>
                  {n}명
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>
    </>
  )

  // ---------- ③ 언제 ----------
  // 관람 동행 체크가 먼저 — 체크 여부가 이야기 자리 시각을 언제로 잡을지 정한다 (시간 순서도 관람이 먼저)
  const whenSection = (
    <>
      <fieldset className="form-group form-group--box" disabled={ended}>
        <legend>
          관람도 함께 <span className="field__optional">선택</span>
        </legend>
        {ended ? (
          <p className="field__hint">끝난 행사 · 이야기 자리만 가능</p>
        ) : (
          <>
            <label className="check">
              <input type="checkbox" checked={form.watchEnabled} onChange={(e) => set('watchEnabled', e.target.checked)} />
              관람부터 함께할 사람도 받기
            </label>
            <p className="field__hint">
              {form.watchEnabled && talkStartDate && !watchApplyOpen(talkStartDate)
                ? '오늘 만나는 모임은 관람 동행 신청 불가'
                : '회차는 승인 뒤 채팅에서 결정 · 신청은 전날까지 · 티켓은 각자 예매'}
            </p>
            {errors.watch && (
              <p className="field__error" role="alert">
                {errors.watch}
              </p>
            )}
          </>
        )}
      </fieldset>

      <fieldset className="form-group">
        <legend>이야기 자리 시각</legend>
        <EventTimeNote event={event} />
        {/* 날짜는 월 달력에서, 시각은 아래 칸에서 — 월 달력엔 시간 칸이 없다 */}
        <Suspense fallback={<div className="talk-cal talk-cal--loading">달력 불러오는 중…</div>}>
          <TalkCalendar event={event} value={form.talkStart} onPickDate={setTalkDate} />
        </Suspense>
        <div className="talk-when">
          <div className="talk-when__day">
            <span className="talk-when__label">고른 날</span>
            <strong>{talkStartDate ? `${formatMonthDay(talkStartDate)} (${formatWeekday(talkStartDate)})` : '날짜 미선택'}</strong>
            <span className="talk-when__bands">{dayBandsText(event, talkStartDate)}</span>
          </div>
          <Field label="시각" error={errors.talkStart} hint={talkStartHint(form)} className="talk-when__time">
            <input type="time" className="input" value={form.talkStart.slice(11, 16)} onChange={(e) => setTalkTime(e.target.value)} />
          </Field>
        </div>
      </fieldset>
    </>
  )

  // ---------- ④ 어디서 · 타임라인 ----------
  // 장소(승인된 사람만) → 동네(모두, 장소에서 자동) → 타임라인(모두). 칸마다 누구에게 보이는지 적는다
  const whereSection = (
    <div className="form-stack">
      <div className="field-block">
        <div className={`field${errors.place ? ' has-error' : ''}`}>
          <span className="field__label">
            이야기 자리 장소
            <span className="field__scope">
              <LockIcon /> 승인된 참여자에게만
            </span>
          </span>
          <PlaceSearch
            value={{ place: form.place, address: form.address, location: form.location }}
            onChange={setPlace}
            near={event.location}
            invalid={Boolean(errors.place)}
          />
          {errors.place && (
            <span className="field__error" role="alert">
              {errors.place}
            </span>
          )}
        </div>
      </div>

      <div className="field-block">
        <Field label="목록에 보일 동네" error={errors.area}>
          <input className="input" value={form.area} placeholder="예: 혜화역 근처" onChange={(e) => set('area', e.target.value)} />
        </Field>
        <FieldPreview label="모임 카드 · 모두에게">
          <MetaLine items={[talkStartDate ? formatMeetupWhen(talkStartDate) : '날짜 미정', <PreviewText key="area" value={form.area} fallback="혜화역 근처" />]} />
        </FieldPreview>
        {!form.areaTouched && form.area && <span className="field__hint">고른 장소에서 가까운 곳으로 자동 입력</span>}
      </div>

      <div className="field">
        <span className="field__label">
          타임라인<span className="field__scope">모임 상세 · 모두에게</span>
        </span>
        <TimelineEditor
          talkStart={talkStartDate}
          area={form.area}
          watch={form.watchEnabled && !ended}
          rows={form.timeline}
          onChange={(rows) => set('timeline', rows)}
          error={errors.timeline}
        />
      </div>
    </div>
  )

  const sections = [introSection, whenSection, whereSection]
  const last = STEPS.length - 1

  return (
    <div className="create-page">
      <Link to={backTo} className="back-link">
        ‹ {editing ? meetup.title : event.title}
      </Link>

      <div className="page-head">
        <h1>{editing ? '모임 수정' : '모임 만들기'}</h1>
        <span className="spacer" />
        {/* ① 은 행사 고르기 (CreatePick) — 여기 스텝은 ②부터 */}
        {!editing && <CreateSteps current={step + 2} />}
      </div>

      <div className="info-layout">
        <EventFacts event={event} canChange={!editing} />

        <form ref={formRef} className="create-form" onSubmit={editing || step === last ? submit : next} noValidate>
          {editing ? (
            // 수정은 한두 칸만 고치는 일이 많아 스텝 없이 한 페이지에 펼친다
            STEPS.map((s, i) => (
              <section key={s.key} className="form-section" aria-labelledby={`form-section-${s.key}`}>
                <h2 id={`form-section-${s.key}`} className="form-section__title">
                  {s.title}
                </h2>
                {sections[i]}
              </section>
            ))
          ) : (
            <>
              <div className="form-step-head">
                <span className="form-step-head__count">
                  {step + 1} / {STEPS.length}
                </span>
                <h2>{STEPS[step].title}</h2>
                <p>{STEPS[step].desc}</p>
              </div>
              {sections[step]}
            </>
          )}

          <div className="form-actions">
            {editing ? (
              <>
                <button type="submit" className="btn btn--primary btn--lg" disabled={submitting}>
                  {submitting ? '저장하는 중…' : '수정 내용 저장'}
                </button>
                <Link to={backTo} className="btn btn--line btn--lg">
                  취소
                </Link>
              </>
            ) : (
              <>
                {step === 0 ? (
                  <Link to={backTo} className="btn btn--line btn--lg">
                    취소
                  </Link>
                ) : (
                  <button type="button" className="btn btn--line btn--lg" onClick={() => setStep(step - 1)}>
                    이전
                  </button>
                )}
                <button type="submit" className="btn btn--primary btn--lg" disabled={submitting}>
                  {step < last ? '다음' : submitting ? '만드는 중…' : '모임 만들기'}
                </button>
                {step === last && <span className="form-actions__note">만들면 채팅방 자동 개설</span>}
              </>
            )}
          </div>
          {submitError && (
            <p className="form-error" role="alert">
              {submitError}
            </p>
          )}

          {editing && <MeetupStatusActions meetup={meetup} />}
        </form>
      </div>
    </div>
  )
}

/** 입력칸 아래 '이렇게 보여요' 미리보기 한 줄 */
function FieldPreview({ label, icon, children }) {
  return (
    <div className="field-preview">
      <span className="field-preview__label">
        {icon}
        {label}
      </span>
      <div className="field-preview__body">{children}</div>
    </div>
  )
}

/** 미리보기 글자 — 비어 있으면 예시를 흐리게 */
function PreviewText({ value, fallback }) {
  const v = value.trim()
  return v ? <span className="field-preview__text">{v}</span> : <span className="field-preview__text is-empty">{fallback}</span>
}

/**
 * 달력 바로 위 행사 회차(운영 시간) 원문 — 달력이 못 읽은 예외('*11.14(토) 18:00 공연')도 여기서 보인다
 */
function EventTimeNote({ event }) {
  if (!event.sessionsText) return null
  const isPeriod = event.runType === 'period'
  const end = estimateEndText(event)

  return (
    <div className="talk-ref">
      <ClockIcon />
      <div className="talk-ref__body">
        <dl className="talk-ref__list">
          <div>
            <dt>{isPeriod ? '운영 시간' : '회차'}</dt>
            <dd>{event.sessionsText}</dd>
          </div>
          {end && (
            <div>
              <dt>예상 종료</dt>
              <dd>{end}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
