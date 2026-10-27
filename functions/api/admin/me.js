import { handle, json } from '../../_lib/http.js';

export const onRequestGet = handle(async ({ data }) => json({ email: data.admin.email }));
