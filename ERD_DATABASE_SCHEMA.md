# SwiftAid - Entity Relationship Diagram & Database Schema

## System Overview

SwiftAid uses **MongoDB** (NoSQL) with three main collections that model the emergency response workflow:

```
┌──────────────────────────────────────────────────────────────────┐
│                        INCIDENT MANAGEMENT                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────┐                                         │
│  │     INCIDENT        │                                         │
│  ├─────────────────────┤               ┌─────────────────────┐   │
│  │ incidentId (PK)     │────assigned──→│      UNIT           │   │
│  │ type                │       to      ├─────────────────────┤   │
│  │ severity            │               │ unitId (PK)         │   │
│  │ status              │               │ type                │   │
│  │ location (lat/lng)  │               │ status              │   │
│  │ assignedUnit (FK)   │               │ location (lat/lng)  │   │
│  │ escalationLevel     │               │ capacity            │   │
│  │ eta                 │               │ createdAt/updatedAt │   │
│  │ timeline (array)    │               └─────────────────────┘   │
│  │ createdAt           │                                         │
│  └─────────────────────┘                                         │
│           │                                                       │
│           │ triggers                                              │
│           ↓                                                       │
│  ┌─────────────────────────────────┐                             │
│  │      NOTIFICATION               │                             │
│  ├─────────────────────────────────┤                             │
│  │ _id (PK - MongoDB ObjectId)     │                             │
│  │ title                           │                             │
│  │ message                         │                             │
│  │ role (operator/responder/all)   │                             │
│  │ incidentId (FK - optional)      │                             │
│  │ createdAt                       │                             │
│  └─────────────────────────────────┘                             │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Collection Schemas

### 1. **INCIDENT** Collection

**Purpose**: Stores emergency incidents and their lifecycle

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `incidentId` | String | ✅ | Unique, e.g., "INC1234567" |
| `type` | String | ✅ | Enum: medical, fire, security, maintenance |
| `severity` | String | ✅ | Enum: critical, high, medium, low |
| `status` | String | ✅ | Enum: open, assigned, acknowledged, en_route, on_site, resolved, cancelled |
| `locationName` | String | ✅ | Human-readable location (e.g., "Block A - Lobby") |
| `location.lat` | Number | ✅ | Latitude (e.g., 18.521) |
| `location.lng` | Number | ✅ | Longitude (e.g., 73.857) |
| `assignedUnit` | String | ❌ | Foreign key to Unit.unitId (null if unassigned) |
| `eta` | String | ❌ | Estimated arrival time (e.g., "5 min") |
| `escalationLevel` | Number | ✅ | 0-3 (auto-increments on time threshold) |
| `timeline` | Array | ✅ | Audit trail of all actions (label + timestamp) |
| `createdAt` | Date | ✅ | Incident creation timestamp |

**Indexes** (for performance):
- `createdAt: -1` → Fast sorting by newest
- `status, createdAt: -1` → Filter by status + sort
- `assignedUnit, createdAt: -1` → Unit's incident history
- `incidentId: 1` → Direct lookup

**Example Document**:
```json
{
  "_id": 1,
  "incidentId": "INC1710009234",
  "type": "medical",
  "severity": "high",
  "status": "en_route",
  "locationName": "Block A - Lobby",
  "location": {
    "lat": 18.521,
    "lng": 73.857
  },
  "assignedUnit": "AMB-01",
  "eta": "5 min",
  "escalationLevel": 1,
  "timeline": [
    {
      "label": "Incident created",
      "timestamp": "2026-03-24T16:40:00Z"
    },
    {
      "label": "Unit AMB-01 assigned",
      "timestamp": "2026-03-24T16:40:05Z"
    },
    {
      "label": "Auto-escalated to level 1",
      "timestamp": "2026-03-24T16:41:05Z"
    }
  ],
  "createdAt": "2026-03-24T16:40:00Z"
}
```

---

### 2. **UNIT** Collection

**Purpose**: Stores emergency response units and their real-time status

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `unitId` | String | ✅ | Unique, e.g., "AMB-01", "FIRE-02", "SEC-01" |
| `type` | String | ✅ | Enum: ambulance, fire, security, maintenance |
| `status` | String | ✅ | Enum: available, busy, offline |
| `location.lat` | Number | ✅ | Current latitude |
| `location.lng` | Number | ✅ | Current longitude |
| `capacity` | Number | ✅ | Max units (e.g., 2 for ambulance, 5 for fire) |
| `createdAt` | Date | ✅ | Unit registration timestamp |
| `updatedAt` | Date | ✅ | Last status/location update |

**Indexes** (for performance):
- `unitId: 1` → Direct lookup
- `type, status, createdAt: 1` → Find available units of type
- `createdAt: -1` → Newest units first

**Example Document**:
```json
{
  "_id": 2,
  "unitId": "AMB-01",
  "type": "ambulance",
  "status": "busy",
  "location": {
    "lat": 18.525,
    "lng": 73.860
  },
  "capacity": 2,
  "createdAt": "2026-03-10T10:00:00Z",
  "updatedAt": "2026-03-24T16:40:05Z"
}
```

---

### 3. **NOTIFICATION** Collection

**Purpose**: Stores real-time alerts for operators and responders

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | ObjectId | ✅ | MongoDB auto-generated |
| `title` | String | ✅ | Notification title (e.g., "Incident created") |
| `message` | String | ✅ | Notification content |
| `role` | String | ✅ | Enum: operator, responder, all |
| `incidentId` | String | ❌ | Foreign key to Incident.incidentId |
| `createdAt` | Date | ✅ | Notification timestamp |

**Indexes** (for performance):
- `role, createdAt: -1` → Fetch notifications by role + sort newest
- `incidentId, createdAt: -1` → Incident's notification history
- `createdAt: -1` → All notifications sorted by time

**Example Document**:
```json
{
  "_id": 3,
  "title": "Incident escalated",
  "message": "INC1710009234 escalated to level 1",
  "role": "operator",
  "incidentId": "INC1710009234",
  "createdAt": "2026-03-24T16:41:05Z"
}
```

---

## Relationships & Cardinality

### **Incident ↔ Unit** (1:N)
- **1 Unit** can have **multiple Incidents** assigned over time
- **1 Incident** can be assigned to **0 or 1 Unit** at a time
- **Foreign Key**: `Incident.assignedUnit` → `Unit.unitId`
- **Logic**: Handled by `dispatchService` (distance-optimized assignment)

### **Incident ↔ Notification** (1:N)
- **1 Incident** can trigger **multiple Notifications** (created, updated, escalated, resolved)
- **1 Notification** references **0 or 1 Incident** (some are generic)
- **Foreign Key**: `Notification.incidentId` → `Incident.incidentId`
- **Logic**: Socket.IO emits notification + MongoDB writes record

### **Unit ↔ Notification** (implied)
- Notifications about unit status changes reference incidents → units indirectly
- No direct FK, but notifications cascade through incident assignment

---

## Data Flow & Business Logic

### **Incident Creation Flow**
```
1. Operator creates incident via API/UI
   ↓
2. MongoDB: Insert new Incident document (status: "open")
   ↓
3. dispatchService: Calculate nearest available Unit using haversine distance
   ↓
4. MongoDB: Update Incident (assignedUnit set, status: "assigned")
   MongoDB: Update Unit (status: "busy")
   ↓
5. MongoDB: Insert Notification for operator
   ↓
6. Socket.IO: Emit "incidentCreated" + "notificationCreated" to all clients
```

### **Escalation Flow**
```
1. escalationService monitor (15s interval):
   - Query Incidents with status = open/assigned
   - Check if elapsed time > severity threshold
   ↓
2. If threshold exceeded:
   - MongoDB: Update Incident (escalationLevel++)
   - Add timeline entry: "Auto-escalated to level X"
   ↓
3. If escalationLevel > 1:
   - dispatchService: Re-evaluate unit assignment
   - If better unit available:
     • Release current unit (status: "available")
     • Assign new unit (status: "busy")
     • Add timeline: "Reassigned from X to Y"
   ↓
4. MongoDB: Insert Notification for operator
   ↓
5. Socket.IO: Emit "incidentEscalated" + "incidentUpdated"
```

### **Responder Action Flow**
```
1. Responder updates incident status (Accept/En Route/On Site/Resolve)
   ↓
2. MongoDB: Update Incident (status changed, timeline appended)
   ↓
3. If status = resolved/cancelled:
   - MongoDB: Update Unit (status: "available")
   - Add unit location from incident location
   ↓
4. MongoDB: Insert Notification for operator + responder
   ↓
5. Socket.IO: Emit "incidentUpdated" + "notificationCreated"
```

---

## Query Performance

### **Common Queries**

**1. Dashboard KPIs (Operator)**
```javascript
// Active incidents count
db.incident.countDocuments({ 
  status: { $in: ["open", "assigned", "acknowledged", "en_route", "on_site"] } 
})

// Critical incidents
db.incident.countDocuments({ 
  severity: "critical",
  status: { $nin: ["resolved", "cancelled"] }
})

// Escalated incidents
db.incident.countDocuments({ 
  escalationLevel: { $gte: 2 },
  status: { $nin: ["resolved", "cancelled"] }
})
```

**2. Unit Availability (Dispatch)**
```javascript
// Find available ambulances
db.unit.find({ 
  type: "ambulance", 
  status: "available" 
}).sort({ createdAt: 1 })

// Used for distance calculation in dispatchService
```

**3. Incident Timeline (Audit)**
```javascript
// Get incident with full history
db.incident.findOne({ incidentId: "INC1234567" })
// Returns timeline array with all actions + timestamps
```

**4. Notifications by Role**
```javascript
// Operator notifications
db.notification.find({ 
  role: { $in: ["operator", "all"] } 
}).sort({ createdAt: -1 }).limit(20)
```

---

## Scalability Considerations

### **Current State**
- ✅ Indexed for fast queries
- ✅ Denormalized for read performance (timeline stored in incident)
- ✅ No joins needed (single-document queries)

### **Future Optimization**
- **Sharding**: By `incidentId` hash if incidents exceed millions
- **TTL Index**: Auto-delete old notifications after 30 days
- **Archival**: Move resolved incidents to separate collection after 90 days
- **Caching**: Redis for real-time unit locations + availability
- **Message Queue**: Bull/RabbitMQ for async notification processing

---

## Summary

| Collection | Documents | Relationships | Indexes |
|-----------|-----------|---------------|---------|
| **INCIDENT** | Emergency incidents | 1:N with Unit, 1:N with Notification | 4 (createdAt, status, assignedUnit, incidentId) |
| **UNIT** | Response units | 1:N from Incident | 3 (unitId, type+status, createdAt) |
| **NOTIFICATION** | Alerts/messages | N:1 from Incident | 3 (role+createdAt, incidentId, createdAt) |

This design is **production-grade**, **audit-friendly** (complete timeline), and **city-scale ready** for hundreds of incidents across dozens of units.
