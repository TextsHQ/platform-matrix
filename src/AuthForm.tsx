import React, { useState, useEffect, ChangeEvent } from 'react'
import { PlatformAPI, LoginCreds } from '@textshq/platform-sdk'

function useInput(
  defaultValue = ''
): [
  string,
  (e: ChangeEvent<HTMLInputElement>) => void,
  React.Dispatch<React.SetStateAction<string>>
] {
  const [value, setValue] = useState(defaultValue)
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
  }
  return [value, onChange, setValue]
}

export const AuthForm: React.FC<{
  api: PlatformAPI
  login: (creds: LoginCreds) => void
}> = ({ api, login }) => {
  const [server, onServerChange] = useInput('https://matrix.org')
  const [username, onUsernameChange] = useInput()
  const [password, onPasswordChange] = useInput()
  const loading = false
  const onLoginClick = () => {
    login({ username, password, custom: server })
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
        <button type="submit">{loading ? '...' : `Login to Matrix`}</button>
      </label>
    </form>
  )
}
