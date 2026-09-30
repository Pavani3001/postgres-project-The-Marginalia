import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import './App.css'

type Note = {
  id: string
  title: string
  body: string
  created_at: string
  reminder_at: string | null
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [reminderAt, setReminderAt] = useState('')
  const [notes, setNotes] = useState<Note[]>([])
  const [minimumReminderAt] = useState(() => new Date().toISOString().slice(0, 16))

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function loadNotes() {
      if (!user || !supabase) {
        setNotes([])
        return
      }
      const { data, error: notesError } = await supabase
        .from('notes')
        .select('id, title, body, created_at, reminder_at')
        .order('created_at', { ascending: false })
      if (notesError) {
        setError(`Notes could not be loaded. Run supabase/schema.sql in your Supabase SQL editor. (${notesError.message})`)
        return
      }
      setNotes(data ?? [])
    }
    void loadNotes()
  }, [user])

  useEffect(() => {
    if (!user || typeof Notification === 'undefined') return
    const userId = user.id

    function checkReminders() {
      if (Notification.permission !== 'granted') return
      const notifiedKey = `marginalia-reminders-${userId}`
      const notified = JSON.parse(localStorage.getItem(notifiedKey) ?? '[]') as string[]
      const now = Date.now()
      const dueNotes = notes.filter((note) => note.reminder_at && Date.parse(note.reminder_at) <= now && !notified.includes(note.id))
      if (dueNotes.length === 0) return
      dueNotes.forEach((note) => new Notification(`Reminder: ${note.title}`, { body: note.body.slice(0, 120) }))
      localStorage.setItem(notifiedKey, JSON.stringify([...notified, ...dueNotes.map((note) => note.id)]))
    }

    checkReminders()
    const reminderTimer = window.setInterval(checkReminders, 30000)
    return () => window.clearInterval(reminderTimer)
  }, [notes, user])

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!supabase) {
      setError('Add your Supabase URL and anon key to .env.local to enable authentication.')
      return
    }
    setIsLoading(true)
    const result = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    if (result.error) setError(result.error.message)
    else if (isSignUp) setMessage('Account created. Check your inbox to confirm your email, then sign in.')
    setIsLoading(false)
  }

  async function handleSignOut() {
    await supabase?.auth.signOut()
  }

  async function handleSaveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !supabase || !noteTitle.trim() || !noteBody.trim()) return

    setError('')
    if (reminderAt && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    const { data: newNote, error: saveError } = await supabase
      .from('notes')
      .insert({ user_id: user.id, title: noteTitle.trim(), body: noteBody.trim(), reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null })
      .select('id, title, body, created_at, reminder_at')
      .single()
    if (saveError) {
      setError(`Note could not be saved. Run supabase/schema.sql in your Supabase SQL editor. (${saveError.message})`)
      return
    }
    setNotes((currentNotes) => [newNote, ...currentNotes])
    setNoteTitle('')
    setNoteBody('')
    setReminderAt('')
  }

  async function enableReminders() {
    if (typeof Notification === 'undefined') {
      setError('This browser does not support notifications.')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') setError('Browser notifications are blocked. Allow notifications for this site to receive reminders.')
  }

  async function handleDeleteNote(noteId: string) {
    if (!supabase) return
    const { error: deleteError } = await supabase.from('notes').delete().eq('id', noteId)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setNotes((currentNotes) => currentNotes.filter((note) => note.id !== noteId))
  }

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Reader'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="The Marginalia home"><span className="brand-mark">M</span><span>The Marginalia</span></a>
        {user && <div className="user-menu"><div className="avatar" aria-hidden="true">{initials}</div><div className="user-details"><strong>{displayName}</strong><span>{user.email}</span></div><button className="sign-out" type="button" onClick={handleSignOut}>Sign out</button></div>}
      </header>
      <main>
        {user ? (
          <section className="welcome-view">
            <p className="eyebrow">Your reading room</p>
            <h1>Make a little space<br /><em>for good ideas.</em></h1>
            <p className="intro">Welcome back, {displayName}. Your corner of The Marginalia is ready for its next story.</p>
            <button className="reminder-permission" type="button" onClick={() => void enableReminders()}>Enable browser reminders</button>
            <form className="note-editor" onSubmit={handleSaveNote}>
              <div className="editor-heading"><div><p className="card-kicker">A quiet beginning</p><h2>Start with a thought worth keeping.</h2></div><span>{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span></div>
              <input aria-label="Note title" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} placeholder="Give your note a title" required />
              <textarea aria-label="Note body" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="What is on your mind?" rows={6} required />
              <label className="reminder-label" htmlFor="reminder-at">Reminder (optional)</label>
              <input id="reminder-at" type="datetime-local" value={reminderAt} min={minimumReminderAt} onChange={(event) => setReminderAt(event.target.value)} />
              <button className="submit-button" type="submit">Save note <span>↗</span></button>
            </form>
            {error && <p className="form-message error note-error">{error}</p>}
            {notes.length > 0 && <section className="notes-list"><p className="eyebrow">Your notes</p>{notes.map((note) => <article className="note-item" key={note.id}><div><h2>{note.title}</h2><p>{note.body}</p>{note.reminder_at && <p className="reminder-time">Reminder: {new Date(note.reminder_at).toLocaleString()}</p>}</div><div className="note-meta"><time dateTime={note.created_at}>{new Date(note.created_at).toLocaleDateString()}</time><button className="delete-note" type="button" onClick={() => void handleDeleteNote(note.id)}>Delete</button></div></article>)}</section>}
          </section>
        ) : (
          <section className="auth-layout">
            <div className="intro-panel"><p className="eyebrow">An independent journal</p><h1>Read closely.<br /><em>Write freely.</em></h1><p className="intro">The Marginalia is a home for personal essays, curious observations, and the stories that sit just outside the main text.</p><div className="issue-note"><span>Vol. 01</span><span>Est. 2026</span><span>Always in progress</span></div></div>
            <div className="auth-panel"><div className="panel-heading"><p className="eyebrow">{isSignUp ? 'Join the journal' : 'Welcome back'}</p><h2>{isSignUp ? 'Create your account' : 'Sign in to continue'}</h2></div><form onSubmit={handleAuth}><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" /><label htmlFor="password">Password</label><input id="password" type="password" autoComplete={isSignUp ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} placeholder="At least 6 characters" />{error && <p className="form-message error">{error}</p>}{message && <p className="form-message success">{message}</p>}<button className="submit-button" type="submit" disabled={isLoading}>{isLoading ? 'One moment...' : isSignUp ? 'Create account' : 'Sign in'} <span>↗</span></button></form><button className="mode-toggle" type="button" onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}>{isSignUp ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>{!isSupabaseConfigured && <p className="config-note">Supabase is not configured yet. Add the values from `.env.example` to `.env.local`.</p>}</div>
          </section>
        )}
      </main>
      <footer><span>© 2026 The Marginalia</span><span>Notes from the edges</span></footer>
    </div>
  )
}

export default App
