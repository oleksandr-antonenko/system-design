import { Effect } from 'effect'
import { setup } from 'foldkit/test/vitest'

import { loadAllLessons } from './courses/registry'

setup()

// Lessons load one by one in the app; tests read every lesson's script and
// texts synchronously, so they are all loaded before a test file runs.
await Effect.runPromise(loadAllLessons)
