'use client' // Ensure this runs on the client

import { Amplify } from 'aws-amplify'
import config from '../lib/amplify-config'

Amplify.configure(config)

export default function AmplifyProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
