import React, { useState, useEffect } from 'react'
import { PlatformAPI, LoginCreds } from '@textshq/platform-sdk'

export const AuthForm: React.FC<{
  api: PlatformAPI
  login: (creds: LoginCreds) => void
}> = ({ api, login }) => {
  const [url, setUrl] = useState(null)
  return <div>Loading...</div>
}
