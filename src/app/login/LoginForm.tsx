'use client';

import { useActionState, useState } from 'react';
import { login, type LoginState } from '../actions';
import { Logo } from '@/components/Logo';
import { Icon } from '@/components/Icon';

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="auth-form" autoComplete="on">
      <Logo size={56} radius={16} />
      <h1>Sign in to Fynro</h1>
      <p className="hint">Your AI finance assistant. Access is by invitation.</p>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="inp" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <div className="keyrow">
          <input id="password" name="password" type={show ? 'text' : 'password'} className="inp" autoComplete="current-password" required maxLength={256} />
          <button type="button" className="ib" style={{ height: 40, width: 40 }} aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}><Icon n={show ? 'eyeoff' : 'eye'} /></button>
        </div>
      </div>
      {state.error && <div className="status no" role="alert"><Icon n="alert" size="s" />{state.error}</div>}
      <button className="btn" style={{ height: 44, width: '100%' }} disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
