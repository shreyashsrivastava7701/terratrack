// campusApi.js: picks where college data lives. Logged in with Supabase -> online;
// no Supabase keys in .env -> on this device only.
import { cloudEnabled } from './supabase.js';
import { useCampusCloud } from './campusCloud.js';
import { useCampusLocal } from './campus.js';

export const useCampusApi = cloudEnabled ? useCampusCloud : useCampusLocal;
