# Proof System Implementation Guide

## Overview
The proof system allows habits to require photographic or location-based proof of completion. This document explains the architecture, components, and integration points.

## Architecture

### Type Definitions
Located in `/src/types/habit.ts`:
- `ProofType`: Union type - `'none' | 'photo' | 'location' | 'photo_or_location'`
- `Habit` interface includes:
  - `proofRequired: ProofType`
  - `proofLocationLat?: number` - Required location latitude
  - `proofLocationLng?: number` - Required location longitude
  - `proofLocationRadius?: number` - Required radius in meters
- `HabitLog` interface includes:
  - `proofPhotoUrl?: string` - URL of uploaded photo
  - `proofLocationLat?: number` - Location where proof was captured
  - `proofLocationLng?: number`
  - `proofVerified: boolean` - Whether proof was successfully submitted

### Database Schema
- **habits table**: `proof_required`, `proof_location_lat`, `proof_location_lng`, `proof_location_radius`
- **habit_logs table**: `proof_photo_url`, `proof_location_lat`, `proof_location_lng`, `proof_verified`
- **Storage bucket**: `proof-photos` - Stores user-uploaded habit completion photos
  - Structure: `{userId}/{habitId}/{logDate}/{filename}`
  - RLS policies enforce user-only access

## Components

### ProofSubmissionModal
**Location**: `/src/components/ProofSubmissionModal.tsx`

Main modal component that coordinates the proof submission flow.

**Props**:
- `visible: boolean` - Control modal visibility
- `habit: Habit` - The habit requiring proof
- `habitLog: HabitLog` - The specific log entry
- `userId: string` - Current user ID
- `onClose: () => void` - Callback when modal closes
- `onProofSubmitted: () => void` - Callback after successful submission

**Features**:
- Menu interface for selecting proof type (photo/location)
- Handles both single and dual proof requirements (`photo_or_location`)
- Prevents submission until all required proof is provided
- Manages transitions between photo capture and location capture

**Usage**:
```tsx
import ProofSubmissionModal from '../components/ProofSubmissionModal';

const [showProof, setShowProof] = useState(false);

<ProofSubmissionModal
  visible={showProof}
  habit={habit}
  habitLog={habitLog}
  userId={userId}
  onClose={() => setShowProof(false)}
  onProofSubmitted={() => {
    setShowProof(false);
    // Refresh habit data
  }}
/>
```

### PhotoProofCapture
**Location**: `/src/components/PhotoProofCapture.tsx`

Camera interface for capturing proof photos.

**Features**:
- Real-time camera preview
- Flip between front and back cameras
- Automatic photo upload to Supabase storage
- Compressed JPEG upload (0.8 quality)
- Shows upload progress indicator
- Permission request handling

**Props**:
- `habitId: string`
- `logDate: string` - Date of habit completion (YYYY-MM-DD)
- `userId: string`
- `onPhotoCapture: (photoUrl: string) => void` - Called with public URL
- `onCancel: () => void`

### LocationProofCapture
**Location**: `/src/components/LocationProofCapture.tsx`

Location verification interface.

**Features**:
- Get current device location
- Verify location is within required radius
- Shows distance to required location if verification fails
- Displays accuracy information
- Permission request handling

**Props**:
- `habitId: string`
- `requiredLat?: number` - Required location latitude
- `requiredLng?: number` - Required location longitude
- `radiusMeters?: number` - Verification radius (default: 100m)
- `onLocationCapture: (location: LocationProofResult) => void`
- `onCancel: () => void`

### ProofButton
**Location**: `/src/components/ProofButton.tsx`

Compact UI button showing proof status on habit cards.

**Props**:
- `proofRequired: ProofType`
- `proofVerified: boolean`
- `onPress: () => void` - Opens proof submission

**Visual States**:
- Camera icon (purple) for photo proof
- Location icon (blue) for location proof
- Green checkmark when proof is verified

## Services and Utilities

### proof-service.ts
**Location**: `/src/lib/proof-service.ts`

Core proof functionality.

**Exported Functions**:

#### uploadPhotoProof(habitId, logDate, photoUri, userId)
Uploads a photo to Supabase storage.
- Reads photo as base64
- Uploads to `proof-photos/{userId}/{habitId}/{logDate}/`
- Returns public URL
- Throws error if upload fails

```typescript
const result = await uploadPhotoProof(habitId, logDate, photoUri, userId);
// result: { photoUrl: string, uploadedAt: string }
```

#### getCurrentLocation()
Gets device's current GPS coordinates.
- Requests location permission if needed
- Uses high accuracy GPS
- Returns coordinates and accuracy

```typescript
const location = await getCurrentLocation();
// location: { lat: number, lng: number, accuracy: number, timestamp: string }
```

#### verifyLocationProof(currentLat, currentLng, requiredLat, requiredLng, radiusMeters)
Verifies if current location is within required radius.
- Uses Haversine formula for distance calculation
- Returns validity and distance info

```typescript
const result = verifyLocationProof(
  currentLat, currentLng,
  habitLat, habitLng,
  100 // 100 meter radius
);
// result: { valid: boolean, reason?: string }
```

#### saveProofToLog(habitLogId, proofPhotoUrl?, proofLocationLat?, proofLocationLng?)
Saves proof data to habit log in database.
- Updates `proof_verified` to true
- Stores photo URL if provided
- Stores location if provided

```typescript
await saveProofToLog(habitLogId, photoUrl, locationLat, locationLng);
```

## Hooks

### useProofSubmission()
**Location**: `/src/hooks/useProofSubmission.ts`

Hook for managing proof submission state and actions.

**Returns**:
- `submitProof(habitLogId, photoUrl?, locLat?, locLng?)` - Async function
- `isLoading: boolean` - Loading state during submission
- `error: string | null` - Error message if submission fails

**Usage**:
```tsx
const { submitProof, isLoading, error } = useProofSubmission();

const handleProofSubmit = async () => {
  const result = await submitProof(
    habitLogId,
    photoUrl,
    locationLat,
    locationLng
  );
  if (result.success) {
    // Success!
  }
};
```

## Integration with Habit Creation/Editing

Both `/app/habit/new.tsx` and `/app/habit/[id]/edit.tsx` include proof configuration:

**UI Elements**:
- Photo proof toggle - Controls `photoProof` state
- Location proof toggle - Controls `locationProof` state

**Logic**:
```typescript
let proofRequired: ProofType = 'none';
if (photoProof && locationProof) proofRequired = 'photo_or_location';
else if (photoProof) proofRequired = 'photo';
else if (locationProof) proofRequired = 'location';
```

## Permissions Configuration

### app.json
Updated with camera and location permission plugins:

**iOS**:
```json
"infoPlist": {
  "NSCameraUsageDescription": "...",
  "NSLocationWhenInUseUsageDescription": "...",
  "NSLocationAlwaysAndWhenInUseUsageDescription": "..."
}
```

**Android**:
```json
"permissions": [
  "android.permission.CAMERA",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION"
]
```

**expo plugins** (automatically handles permissions):
```json
["expo-camera", { "cameraPermission": "..." }],
["expo-location", { "locationAlwaysAndWhenInUsePermission": "..." }]
```

## Package Dependencies Added

```json
{
  "expo-camera": "~15.0.14",
  "expo-file-system": "~18.0.11",
  "expo-location": "~18.0.9",
  "expo-image-picker": "~15.0.7"
}
```

## Implementation Steps

### Step 1: Install Dependencies
```bash
cd /path/to/ritual
npm install
# or
yarn install
```

### Step 2: Add Components to Habit Screen
In the habit detail screen (`/app/habit/[id]/index.tsx`), add:
```tsx
import ProofSubmissionModal from '../../../src/components/ProofSubmissionModal';
import ProofButton from '../../../src/components/ProofButton';

// State for proof modal
const [showProofModal, setShowProofModal] = useState(false);
const [selectedLogForProof, setSelectedLogForProof] = useState<HabitLog | null>(null);

// On proof button press
const handleProofPress = (log: HabitLog) => {
  setSelectedLogForProof(log);
  setShowProofModal(true);
};

// In JSX
{habit && selectedLogForProof && (
  <ProofSubmissionModal
    visible={showProofModal}
    habit={habit}
    habitLog={selectedLogForProof}
    userId={userId}
    onClose={() => setShowProofModal(false)}
    onProofSubmitted={() => {
      setShowProofModal(false);
      fetchHabits(); // Refresh
    }}
  />
)}
```

### Step 3: Add Proof Status Display
In habit cards, display proof status:
```tsx
<ProofButton
  proofRequired={habit.proofRequired}
  proofVerified={todayLog?.proofVerified ?? false}
  onPress={() => handleProofPress(todayLog)}
/>
```

## Error Handling

### Camera Errors
- Permission denied: Shows permission request UI
- Photo capture failed: Alert with retry option
- Upload failed: Displays error message with retry

### Location Errors
- Permission denied: Shows permission request UI
- Location unavailable: Alert about device settings
- Location verification failed: Shows distance feedback
- Save failed: Alert with retry option

## Security Considerations

1. **RLS Policies**: Storage bucket restricts uploads to user's own folder
2. **User validation**: All proof operations include user_id validation
3. **File validation**: Photos validated before upload
4. **Location privacy**: Coordinates stored but only accessible to user

## Testing Checklist

- [ ] Camera permission request flows
- [ ] Photo capture and upload
- [ ] Location permission request flows
- [ ] Location capture and verification
- [ ] Dual proof requirement (photo + location)
- [ ] Photo + location optional combinations
- [ ] Network failure handling
- [ ] Permission denial handling
- [ ] Proof displays in habit logs
- [ ] Proof visible in database

## Future Enhancements

1. **Photo validation**: AI-based content verification
2. **Geofencing**: Background location monitoring
3. **Proof history**: Gallery view of all submitted proofs
4. **Proof expiry**: Auto-invalidate after time period
5. **Multiple photos**: Allow multiple proof photos per log
6. **Location history**: Track location patterns
7. **Proof sharing**: Share proofs with accountability partners

