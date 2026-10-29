import { handle } from '../../../_lib/http.js';
import { reorder } from '../../../_lib/reorder.js';

export const onRequestPost = handle(({ request, env }) => reorder(request, env, 'projects'));
