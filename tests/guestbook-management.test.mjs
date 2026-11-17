import test from 'node:test';
import assert from 'node:assert/strict';
import {deleteGuestbookMessage} from '../api/_lib/guestbook-management.js';
test('moderation deletes only the selected existing ID and never accepts raw Redis members',async()=>{const messages=[JSON.stringify({id:'gb-a',message:'keep'}),JSON.stringify({id:'gb-b',message:'delete'})];const calls=[];const store={command:async args=>{calls.push(args);return args[0]==='ZREVRANGE'?messages:1}};assert.deepEqual(await deleteGuestbookMessage(store,'gb-b'),{ok:true});assert.deepEqual(calls[1],['ZREM','shiloku:guestbook:v1',messages[1]]);await assert.rejects(deleteGuestbookMessage(store,'missing'),e=>e.status===404);await assert.rejects(deleteGuestbookMessage(store,{raw:'anything'}),e=>e.status===400)});
