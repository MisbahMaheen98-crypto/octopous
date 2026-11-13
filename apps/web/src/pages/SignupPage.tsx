import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { BrandLogo } from '../components/branding/BrandLogo';
import { signup } from '../lib/auth/auth-client';

export function SignupPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setErrorCode(null);
    setIsSubmitting(true);

    const result = await signup({
      username,
      email,
      password,
      confirmPassword,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setErrorCode(result.error.code);
      let message = result.error.message;
      if (
        result.error.code === 'ACCOUNT_EXISTS' &&
        message === 'Unable to create account with these credentials'
      ) {
        message = 'An account with this email or username already exists. Please sign in instead.';
      }
      setError(message);
      return;
    }

    navigate(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`, {
      state:
        !import.meta.env.PROD &&
        result.data.deliveryMode === 'DEVELOPMENT_FALLBACK' &&
        typeof result.data.developmentOtp === 'string'
          ? {
              developmentOtp: result.data.developmentOtp,
              deliveryMode: result.data.deliveryMode,
            }
          : undefined,
    });
  };

  const isExistingAccount =
    errorCode === 'ACCOUNT_EXISTS' ||
    (error && (error.toLowerCase().includes('already') || error.toLowerCase().includes('credentials')));

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-brand">
          <BrandLogo variant="full" />
          <div className="brand-sub">Create your secure OCTOPUS account</div>
        </div>

        <label className="eyebrow" htmlFor="signup-username">
          Username
        </label>
        <Input
          id="signup-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
        />

        <label className="eyebrow" htmlFor="signup-email">
          Gmail address
        </label>
        <Input
          id="signup-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />

        <label className="eyebrow" htmlFor="signup-password">
          Password
        </label>
        <Input
          id="signup-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
        />

        <label className="eyebrow" htmlFor="signup-confirm-password">
          Confirm password
        </label>
        <Input
          id="signup-confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          required
        />

        {error ? (
          <div className="form-error" role="alert" style={{ marginBottom: '1rem' }}>
            <p>{error}</p>
            {isExistingAccount ? (
              <p style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <Link to="/login" className="teal" style={{ textDecoration: 'underline', fontWeight: 600 }}>
                  👉 Click here to Sign In
                </Link>
                {email ? (
                  <Link
                    to={`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`}
                    className="teal"
                    style={{ textDecoration: 'underline', fontSize: '0.875rem' }}
                  >
                    Need to enter OTP? Verify email
                  </Link>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}

        <Button variant="primary" type="submit" disabled={isSubmitting} className="auth-submit">
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </Button>

        <p className="auth-links muted">
          Have an account? <Link className="teal" to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
