// ProofSync.jsx: keeps a student's trees in step with the college's photo decisions.
// When the college rejects a tree photo, that tree stops giving credit; if they undo it, the credit comes back.
import { useEffect } from 'react';
import { useCampusApi } from '../lib/campusApi.js';
import { markRejectedTrees } from '../lib/store.js';

export default function ProofSync() {
  const campus = useCampusApi();
  const key = campus.proofs
    .filter((p) => p.studentId === campus.me && p.status === 'rejected')
    .map((p) => p.activityId)
    .sort()
    .join('|');
  useEffect(() => {
    if (campus.ready) markRejectedTrees(new Set(key ? key.split('|') : []));
  }, [key, campus.ready, campus.me]);
  return null;
}
