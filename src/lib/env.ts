import { z } from 'zod'

const schema = z.object({
  VITE_API_BASE_URL: z.string().default('/api/v1'),
  VITE_USE_MOCKS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
})

export const env = schema.parse(import.meta.env)
