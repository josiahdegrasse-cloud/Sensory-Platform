# ISSF Platform Demo Instructions

## Quick Start

The ISSF (Integrated Sensory Screening Framework) platform is a functional multi-user system for evaluating plant-based cheese using a hybrid approach combining instrumental measurements, semi-trained panels, and human-centered design.

## Demo Accounts

### Panelist Accounts
**Access:** Questionnaires only

| Email | Password | Name | ID |
|-------|----------|------|-----|
| panelist1@example.com | demo123 | Sarah Johnson | P001 |
| panelist2@example.com | demo123 | Michael Chen | P002 |
| panelist3@example.com | demo123 | Emily Rodriguez | P003 |
| panelist4@example.com | demo123 | James Wilson | P004 |
| panelist5@example.com | demo123 | Maria Garcia | P005 |

**Panelist Features:**
- Fill out product questionnaires
- CATA (Check-All-That-Apply) attribute selection
- Intensity ratings (0-10 scale)
- Hedonic liking scores (9-point scale)
- Emotional profile (EsSense25)
- Cannot submit duplicate evaluations for same product
- Cannot see other panelists' data or admin features

### Administrator Account
**Access:** Full system access + configuration

| Email | Password | Name |
|-------|----------|------|
| admin@example.com | demo123 | Admin User |

**Administrator Features:**
- Full access to all 4-step evaluation process
- Machine testing data (E-Tongue + GC-O)
- Survey analysis (CATA, hedonic, emotions)
- GO/TWEAK/STOP decision dashboard
- **Dairy Comparison Tool** - Compare plant-based samples to dairy benchmarks
- AI-powered formulation suggestions
- **Product & Questionnaire Configuration** - Create products and customize attributes
- **User management** - View all panelist responses

---

## Key Features Demonstrated

### 1. **Role-Based Access Control**
- Panelists only see questionnaires
- Developers see all data AND can configure products/questionnaires
- Admins have full access (same as developers in this version)

### 2. **Dynamic Questionnaire Configuration**
- Admin can customize which attributes appear
- Different products can have different attribute sets
- Add custom attributes (e.g., "Smoky" for smoked varieties)

### 3. **Duplicate Submission Prevention**
- Each panelist can only submit ONE response per product
- Tracks completion status per user
- Shows "Already Completed" message if attempting duplicate

### 4. **Multi-User Data Collection**
- Each response linked to panelist ID
- Timestamps recorded
- Data stored locally (simulating database)

### 5. **Dairy Comparison & Formulation Suggestions**
- Compare plant-based samples to dairy controls
- Visualize gaps in taste, composition, and hedonic scores
- AI-generated suggestions for closing gaps
- Priority-ranked recommendations (critical/high/medium)

---

## Testing Workflow

### As a Panelist:
1. Login with `panelist1@example.com` / `demo123`
2. See available questionnaires
3. Click "Start Questionnaire" on any product
4. Fill out all 4 sections (CATA, Intensity, Hedonic, Emotions)
5. Submit
6. See confirmation and redirect to dashboard
7. Try to submit again → blocked with "Already Completed" message

### As a Developer:
1. Login with `developer@example.com` / `demo123`
2. Navigate through 4-step evaluation process
3. View instrumental data (Step 1: Machine Testing)
4. See panelist form templates (Step 2)
5. Analyze aggregated results (Step 3)
6. Review GO/TWEAK/STOP decision (Step 4)
7. Use **Dairy Comparison** to compare samples and get formulation suggestions

### As an Admin:
1. Login with `admin@example.com` / `demo123`
2. Navigate to "Admin Config"
3. Create a new product (e.g., "Almond Feta v1.0")
4. Configure custom attributes for that product
5. Mark products as active/completed
6. Customize which CATA attributes appear in questionnaires

---

## Data Storage
Currently using **localStorage** to simulate a database:
- User sessions persist across page refreshes
- Questionnaire responses saved locally
- Product configurations saved locally
- Completion tracking saved locally

**For production:** Replace localStorage with Supabase database for:
- Real authentication with password hashing
- Persistent multi-user data storage
- Access control with Row Level Security
- Real-time data synchronization

---

## Technical Notes

### Mock Data
- Pre-populated with 14 plant-based samples + 2 dairy controls
- Some panelists have pre-existing responses (mock data)
- All instrumental data is realistic (based on research)

### Questionnaire Structure
1. **CATA (Check-All-That-Apply):** 28+ attributes
2. **Intensity Ratings:** 8 key attributes (0-10 scale)
3. **Hedonic Scores:** 5 aspects (1-9 scale)
4. **Emotional Profile:** EsSense25 (25 emotions, 0-5 scale)

### Quality Standards
Built-in benchmarks for GO/TWEAK/STOP:
- Hedonic ≥7.0 = GO
- Emotional balance ≥+2.0 = GO
- Off-notes with intensity ≥3 = STOP
- Panel agreement ≥60% = Strong consensus

---

## What's Next (Production Implementation)

To make this production-ready with Supabase:

1. **Database Schema:**
   - `users` table (id, email, role, panelist_id)
   - `products` table (id, name, category, status, custom_attributes)
   - `responses` table (id, user_id, product_id, cata_data, hedonic_data, etc.)
   - `completion_tracking` table (user_id, product_id, completed_at)

2. **Row Level Security:**
   - Panelists can only read their own responses
   - Developers can read all responses (no write)
   - Admins have full access

3. **Real Authentication:**
   - Supabase Auth with email/password
   - JWT tokens
   - Password reset flows

4. **Real-time Features:**
   - Live response tracking
   - Notification when panelists complete evaluations
   - Dashboard updates in real-time

---

## Questions?
This prototype demonstrates all requested features:
✅ Login system with role-based access
✅ Customizable questionnaire attributes per product
✅ Panelist-only view of questionnaires
✅ Developer-only view of data
✅ Admin configuration panel
✅ Duplicate submission prevention
✅ Response tracking per user
✅ Dairy comparison with formulation suggestions