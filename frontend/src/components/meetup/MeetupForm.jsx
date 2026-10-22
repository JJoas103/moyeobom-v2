import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Field from '../common/Field'
import ErrorMessage from '../ErrorMessage'
import CreateSteps from './CreateSteps'
import EventFacts from './EventFacts'
import CardPreview from './CardPreview'
import MeetupStatusActions from './MeetupStatusActions'
import { createMeetup, updateMeetup, uploadMeetupImage } from '../../data/meetups'
import { BUDGETS } from '../../data/constants'
import { assetUrl } from '../../utils/asset'
import { eventStatus } from '../../utils/status'
import { formatTime } from '../../utils/format'
import { canOpenMeetup } from '../../utils/event'
import { addMinutes, fromLocalInput, toLocalInput } from '../../utils/datetime'
import { guessArea, suggestDraft } from '../../utils/meetupDraft'

const TITLE_MAX = 40
const INTRO_MAX = 200
const TIMELINE_TITLE_MAX = 30 // 타임라인 '모두' 칸 제목 (백엔드와 같게)
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const IMAGE_MAX = 20 * 1024 * 1024 // 백엔드 config/upload.js uploadMeetup 과 같게
const CAPACITIES = [2, 3, 4, 5, 6, 7, 8, 9, 10]

function initialForm(event, meetup) {
  const s = suggestDraft(event)
  const ended = eventStatus(event).tone === 'closed'
  // 수정 — 저장된 값 그대로 (관람 동행을 안 받던 모임은 회차 · 만나는 곳을 제안값으로)
  if (meetup) {
    const { talk, watch } = meetup
    return {
      title: meetup.title,
      intro: meetup.intro || '',
      talkStart: toLocalInput(talk.startAt),
      startTitle: talk.startTitle || '',
      place: talk.place || '',
      area: talk.area,
      areaTouched: true,
      alcohol: meetup.alcohol,
      budget: meetup.budget,
      capacity: meetup.capacity,
      watchEnabled: Boolean(watch?.enabled) && !ended,
      sessionAt: toLocalInput(watch?.sessionAt || s.sessionAt),
      meetPlace: watch?.meetPlace || s.meetPlace,
      _hint: { ...s, suggestedFromSession: false },
    }
  }
  return {
    title: '',
    intro: '',
    talkStart: toLocalInput(s.talkStart),
    startTitle: '',
    place: '',
    area: '',
    areaTouched: false,
    alcohol: false,
    budget: '1to2',
    capacity: 4,
    watchEnabled: !ended, // 끝난 행사는 이야기 자리만
    sessionAt: toLocalInput(s.sessionAt),
    meetPlace: s.meetPlace,
    _hint: s,
  }
}

function validate(form, event) {
  const e = {}
  const now = new Date()
  const title = form.title.trim()
  if (!title) e.title = '모임 제목을 적어 주세요.'
  else if (title.length > TITLE_MAX) e.title = `${TITLE_MAX}자 안으로 줄여 주세요.`
  if (form.intro.length > INTRO_MAX) e.intro = `${INTRO_MAX}자 안으로 줄여 주세요.`

  const start = fromLocalInput(form.talkStart)
  if (!start) e.talkStart = '만나는 날짜와 시각을 골라 주세요.'
  else if (start <= now) e.talkStart = '지금보다 뒤의 시각으로 골라 주세요.'

  const startTitle = form.startTitle.trim()
  if (!startTitle) e.startTitle = '만나서 할 일을 적어 주세요.'
  else if (startTitle.length > TIMELINE_TITLE_MAX) e.startTitle = `${TIMELINE_TITLE_MAX}자 안으로 줄여 주세요.`

  if (!form.place.trim()) e.place = '만날 장소를 적어 주세요.'
  if (!form.area.trim()) e.area = '목록에 보일 동네를 적어 주세요. 예: 혜화역 근처'

  if (form.watchEnabled) {
    const session = fromLocalInput(form.sessionAt)
    if (!session) e.sessionAt = '관람 회차 시각을 골라 주세요.'
    else if (session <= now) e.sessionAt = '지금보다 뒤의 회차로 골라 주세요.'
    else if (start && session >= start) e.sessionAt = '관람은 이야기 자리보다 먼저여야 해요.'
    else if (event.endDate && session > new Date(event.endDate)) e.sessionAt = '행사 기간이 지난 회차예요.'
    if (!form.meetPlace.trim()) e.meetPlace = '관람 전에 만날 곳을 적어 주세요.'
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
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [image, setImage] = useState(null) // 새로 고른 사진 { file, url }
  const [savedImage, setSavedImage] = useState(meetup?.imageUrl || '') // 수정 — 이미 올린 사진 경로
  const ended = eventStatus(event).tone === 'closed'
  const openable = editing || canOpenMeetup(event)
  const hint = form._hint
  const minCapacity = Math.max(2, meetup?.approvedCount || 0) // 승인된 인원보다 적게 못 줄임
  const backTo = editing ? `/meetup/${meetup._id}` : `/event/${event._id}`

  // 미리보기용 object URL 정리 (제출 때 파일은 서버에 따로 업로드)
  useEffect(
    () => () => {
      if (image?.url) URL.revokeObjectURL(image.url)
    },
    [image],
  )

  const set = (key, value) => {
    setForm((f) => {
      const next = { ...f, [key]: value }
      // 장소 입력 시 '목록에 보일 동네' 자동 채움 (직접 고친 뒤로는 그대로)
      if (key === 'place' && !f.areaTouched) next.area = guessArea(value)
      if (key === 'area') next.areaTouched = true
      return next
    })
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const onImage = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일을 다시 골라도 onChange 가 오도록
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type)) return setErrors((x) => ({ ...x, image: 'JPG · PNG · WEBP 사진만 올릴 수 있어요.' }))
    if (file.size > IMAGE_MAX) return setErrors((x) => ({ ...x, image: '20MB 이하 사진만 올릴 수 있어요.' }))
    setErrors((x) => ({ ...x, image: undefined }))
    setImage({ file, url: URL.createObjectURL(file) })
  }

  const submit = async (e) => {
    e.preventDefault()
    const found = validate(form, event)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      // 첫 오류 칸으로 이동
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus())
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
    const session = form.watchEnabled ? fromLocalInput(form.sessionAt) : null
    const body = {
      event: event._id,
      title: form.title.trim(),
      intro: form.intro.trim(),
      imageUrl,
      talk: {
        startAt: talkStart.toISOString(),
        place: form.place.trim(),
        area: form.area.trim(),
        startTitle: form.startTitle.trim(),
      },
      alcohol: form.alcohol,
      budget: form.budget,
      capacity: Number(form.capacity),
      watch: form.watchEnabled
        ? {
            enabled: true,
            sessionAt: session.toISOString(),
            meetAt: addMinutes(session, -20).toISOString(),
            meetPlace: form.meetPlace.trim(),
          }
        : { enabled: false },
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
      if (err.fieldErrors) setErrors(err.fieldErrors)
      setSubmitError(err.message)
      setSubmitting(false)
    }
  }

  const talkStartDate = fromLocalInput(form.talkStart)

  if (!openable) {
    return (
      <ErrorMessage
        title="이 행사로는 모임을 열 수 없어요"
        message="끝난 지 오래된 행사예요. 다른 행사를 골라 주세요."
      />
    )
  }

  return (
    <div className="create-page">
      <Link to={backTo} className="back-link">
        ‹ {editing ? meetup.title : event.title}
      </Link>

      <div className="page-head">
        <h1>{editing ? '모임 수정' : '모임 만들기'}</h1>
        <span className="spacer" />
        {!editing && <CreateSteps current={2} />}
      </div>

      <div className="info-layout">
        <EventFacts event={event} canChange={!editing} />

        <form ref={formRef} className="create-form" onSubmit={submit} noValidate>
          <div className="create-form__head">
            <span>여기만 채우면 됩니다</span>
            <span className="create-form__head-sub">‘선택’이 없는 칸은 모두 필수예요</span>
          </div>

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
                placeholder="예: 각자 보고 끝나고 넘버 얘기만 해요. 처음 오셔도 괜찮아요."
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
                  <span>JPG · PNG · 세로 3:4로 보여요</span>
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
                      '올리지 않으면 행사 포스터가 모임 카드 이미지로 쓰여요.'
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ---------- 이야기 자리 ---------- */}
          <fieldset className="form-group">
            <legend>이야기 자리</legend>
            <div className="form-grid form-grid--2">
              <Field
                label="만나는 시각"
                error={errors.talkStart}
                hint={hint.suggestedFromSession ? `${endWord(event)} 끝날 즈음(${formatTime(hint.sessionEnd)})으로 제안해 두었어요.` : null}
              >
                <input type="datetime-local" className="input" value={form.talkStart} onChange={(e) => set('talkStart', e.target.value)} />
              </Field>
              {/* 타임라인 '모두' 칸 제목 — 만나는 시각과 함께 보인다 */}
              <Field
                label="만나서 할 일"
                error={errors.startTitle}
                hint="타임라인에 만나는 시각과 함께 보여요."
                count={[form.startTitle.length, TIMELINE_TITLE_MAX]}
              >
                <input
                  className="input"
                  value={form.startTitle}
                  maxLength={TIMELINE_TITLE_MAX + 10}
                  placeholder="예: 근처 카페에서 넘버 얘기"
                  onChange={(e) => set('startTitle', e.target.value)}
                />
              </Field>
            </div>
            <div className="form-grid form-grid--place">
              <Field label="장소" error={errors.place} hint="정확한 장소는 승인된 참여자에게만 보여요.">
                <input
                  className="input"
                  value={form.place}
                  placeholder="예: 혜화역 2번 출구 근처 OO카페"
                  onChange={(e) => set('place', e.target.value)}
                />
              </Field>
              <Field label="목록에 보일 동네" error={errors.area} hint="신청 전에는 이것만 보여요.">
                <input className="input" value={form.area} placeholder="예: 혜화역 근처" onChange={(e) => set('area', e.target.value)} />
              </Field>
            </div>
          </fieldset>

          {/* ---------- 신청 전에 공개할 조건 ---------- */}
          <fieldset className="form-group">
            <legend>신청 전에 공개할 조건</legend>
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
                hint={editing && meetup.approvedCount > 0 ? `이미 승인한 ${meetup.approvedCount}명보다 적게는 못 줄여요.` : '신청을 받고 호스트가 승인해요.'}
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

          {/* ---------- 관람도 함께 ---------- */}
          <fieldset className="form-group form-group--box" disabled={ended}>
            <legend>
              관람도 함께 <span className="field__optional">선택</span>
            </legend>
            {ended ? (
              <p className="field__hint">이미 끝난 행사라 이야기 자리만 열 수 있어요.</p>
            ) : (
              <>
                <label className="check">
                  <input type="checkbox" checked={form.watchEnabled} onChange={(e) => set('watchEnabled', e.target.checked)} />
                  관람부터 함께할 사람도 받을게요
                </label>
                {form.watchEnabled && (
                  <div className="form-grid form-grid--2">
                    <Field label="관람 회차" error={errors.sessionAt} hint={event.sessionsText ? `회차: ${event.sessionsText}` : null}>
                      <input type="datetime-local" className="input" value={form.sessionAt} onChange={(e) => set('sessionAt', e.target.value)} />
                    </Field>
                    <Field label="만나는 곳" error={errors.meetPlace} hint="회차 20분 전에 만나요.">
                      <input className="input" value={form.meetPlace} placeholder="예: 공연장 로비" onChange={(e) => set('meetPlace', e.target.value)} />
                    </Field>
                  </div>
                )}
                <p className="field__hint">티켓은 각자 예매해요. 이미 본 사람은 이야기 자리만 신청할 수 있어요.</p>
              </>
            )}
          </fieldset>

          <div className="form-actions">
            <button type="submit" className="btn btn--primary btn--lg" disabled={submitting}>
              {editing ? (submitting ? '저장하는 중...' : '수정 내용 저장') : submitting ? '만드는 중...' : '모임 만들기'}
            </button>
            <Link to={backTo} className="btn btn--line btn--lg">
              취소
            </Link>
            {!editing && <span className="form-actions__note">만들면 모임 채팅방이 자동으로 열려요.</span>}
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

const endWord = (event) => ({ film: '영화가', exhibition: '관람이', festival: '행사가' })[event.category] || '공연이'
