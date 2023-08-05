import { textsRenderer, AuthProps } from '@textshq/platform-sdk'
import type { ChangeEvent } from 'react'
import type React from 'react'

const { React } = textsRenderer
const { useState } = React

function useInput(defaultValue = ''): [
    string,
    (e: ChangeEvent<HTMLInputElement>) => void,
    React.Dispatch<React.SetStateAction<string>>,
  ] {
  const [value, setValue] = useState(defaultValue)
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
  }
  return [value, onChange, setValue]
}

const AuthForm: React.FC<AuthProps> = ({ login }) => {
  const [server, onServerChange] = useInput('https://matrix.org')
  const [username, onUsernameChange] = useInput()
  const [password, onPasswordChange] = useInput()
  const [loading, setLoading] = useState(false)
  const onLoginClick = async () => {
    setLoading(true)
    await login({ username, password, custom: server })
    setLoading(false)
  }
  return (
    <form onSubmit={onLoginClick}>
      <label>
        <span>Server</span>
        <input
          onChange={onServerChange}
          value={server}
          placeholder="https://matrix.org"
        />
      </label>
      <label>
        <span>Username</span>
        <input onChange={onUsernameChange} value={username} />
      </label>
      <label>
        <span>Password</span>
        <input type="password" onChange={onPasswordChange} value={password} />
      </label>
      <label>
        <button type="submit" disabled={loading}>{loading ? '...' : 'Login to Matrix'}</button>
      </label>
    </form>
  )
}

export default AuthForm
