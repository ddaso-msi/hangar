import { json } from './_lib'

/** Unknown API paths get a JSON 404, not the SPA shell with a 200. */
export const onRequest: PagesFunction = () => json({ error: 'not found' }, 404)
