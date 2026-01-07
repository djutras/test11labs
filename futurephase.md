# Future Phases - CSV Call Campaign System

## Phase 2: Call History & Reports

### Call History Page (`/calls/history`)
- Table: Date, Campaign, Name, Phone, Direction, Duration, Outcome, Review Status
- Search by name or phone
- Filter by: campaign, outcome, review status, date range
- Bulk actions: Mark reviewed, export selected
- Click row → expand transcript + audio player

### Upcoming Calls Queue (`/calls/upcoming`)
- Table: Scheduled time, Campaign, Name, Phone
- Actions per row: Call Now, Skip, Reschedule
- Filter by campaign
- Bulk skip/reschedule

---

## Phase 3: DNC & Client Management

### DNC Management Page (`/dnc`)
- Table: Phone, Reason, Added By, Date, Scope (global/campaign)
- Add number button
- Import CSV button
- Remove from DNC action
- Search by phone

### Client Detail Page (`/campaigns/[id]/clients/[clientId]`)
- Client info (name, phone, tags, notes)
- Call history timeline
- Each call: date, duration, outcome, transcript, audio player
- Add notes button
- Add to DNC button

---

## Phase 4: Manual Controls

### Call Now
- Button on scheduled call or client
- Bypasses queue, calls immediately
- Respects DNC list

### Skip Call
- Remove from queue without calling
- Requires reason (dropdown + optional note)
- Logged in history

### Reschedule
- Change scheduled time
- Must be within campaign hours

### Re-call
- For completed calls
- Creates new scheduled_call entry
- Useful for follow-ups

---

## Phase 5: Analytics Dashboard

### Campaign Analytics
- Success rate (answered / total attempted)
- Average call duration
- Outcomes breakdown (pie chart)
- Progress percentage
- Calls over time chart

### Main Dashboard (`/dashboard`)
- Active campaigns summary
- Today's stats (calls made, success rate)
- Quick actions (pause all, view queue)
- Recent calls feed
- Upcoming calls (next hour)

---

## Phase 6: Export & Notifications

### Export Features
- Campaign results CSV (all clients + status + outcomes)
- History export (date range, includes transcript text)
- Transcript download (.txt per call)

### Daily Summary Email (Optional)
- Calls completed today
- Success rate
- Notable outcomes

---

## Phase 7: Advanced Features

### Tags & Notes
- Add tags to clients (e.g., "interested", "callback", "not-interested")
- Filter by tags in reports
- Notes on calls and client records

### Retry Logic
- Implement automatic retry scheduling
- Retry failed calls once later same day
- Max 2 voicemail retries
- Track retry count

### Voicemail Detection
- Implement Twilio AMD (Answering Machine Detection)
- Handle voicemail based on campaign setting:
  - Hangup and retry
  - Leave pre-recorded message
  - Mark and move on

### Inbound Call Linking
- When client calls back, link to campaign
- Show in client history
- Email notification for inbound calls

---

## API Endpoints Still Needed

### Call Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/calls/[id]/call-now` | Force call immediately |
| POST | `/api/calls/[id]/skip` | Skip scheduled call |
| POST | `/api/calls/[id]/reschedule` | Reschedule call |
| POST | `/api/calls/[id]/retry` | Re-call completed client |
| PATCH | `/api/calls/[id]/notes` | Add/update notes |
| PATCH | `/api/calls/[id]/review` | Mark reviewed/needs-follow-up |

### History & Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/calls/history` | All calls (paginated, searchable) |
| GET | `/api/calls/upcoming` | Scheduled queue |
| GET | `/api/calls/export` | Export all calls as CSV |
| GET | `/api/campaigns/[id]/export` | Export campaign results |

### DNC Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dnc` | List DNC numbers |
| POST | `/api/dnc` | Add to DNC |
| DELETE | `/api/dnc/[phone]` | Remove from DNC |
| POST | `/api/dnc/import` | Bulk import DNC list |

### Client Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients/[id]` | Client details |
| GET | `/api/clients/[id]/history` | Client call history |
| PATCH | `/api/clients/[id]` | Update client (notes, tags, active) |
| POST | `/api/clients/[id]/dnc` | Add client to DNC |

---

## Environment Variables Needed

```
RESEND_API_KEY=       # For email notifications (free tier: 3,000/month)
```

---

## Notes

- Netlify Scheduled Functions require **Pro plan** for custom schedules
- Free tier runs functions but schedule may be limited
- Consider Vercel Cron as alternative if needed
