import { cleanPastedLine, parseBulkText } from '../src/components/changes/BulkAddPointsModal';
import { ChangeChecklistItem } from '../src/types';

console.log('=== TEST SUITE: Bulk Add Verification Points ===\n');

// 1. Line Cleaning Tests
console.log('--- 1. Line Cleaning Tests ---');
const cleanCases = [
  { input: '1. Bus Booking - Successful Booking', expected: 'Bus Booking - Successful Booking' },
  { input: '2) Bus Booking - Failed Booking', expected: 'Bus Booking - Failed Booking' },
  { input: '(3) Bus Booking - Cancellation', expected: 'Bus Booking - Cancellation' },
  { input: '[4] Hotel Booking - Successful', expected: 'Hotel Booking - Successful' },
  { input: '• Flight Booking - Successful', expected: 'Flight Booking - Successful' },
  { input: '- Hotel Booking - Failed', expected: 'Hotel Booking - Failed' },
  { input: '* Flight Booking - Cancellation', expected: 'Flight Booking - Cancellation' },
  { input: '– Train Booking - Booked', expected: 'Train Booking - Booked' },
  { input: '— Cab Booking - Booked', expected: 'Cab Booking - Booked' },
  { input: '▪ Metro Booking - Card Recharge', expected: 'Metro Booking - Card Recharge' },
  { input: '1. - Double prefix test', expected: 'Double prefix test' },
  { input: '   Spacing and indentation   ', expected: 'Spacing and indentation' },
  { input: '"Quoted from Excel"', expected: 'Quoted from Excel' },
  { input: 'Normal line without bullets', expected: 'Normal line without bullets' },
];

let cleanPassed = 0;
cleanCases.forEach((tc, idx) => {
  const actual = cleanPastedLine(tc.input);
  if (actual === tc.expected) {
    cleanPassed++;
  } else {
    console.error(`FAIL [${idx}]: input "${tc.input}" -> expected "${tc.expected}", got "${actual}"`);
  }
});
console.log(`Clean line tests: ${cleanPassed}/${cleanCases.length} passed.`);

// 2. 5 Items Test
console.log('\n--- 2. Five Checklist Items Test ---');
const fiveItemsInput = `
1. Bus Booking - Successful Booking
2. Bus Booking - Failed Booking
3. Hotel Booking - Successful Booking
4. Hotel Booking - Failed Booking
5. Flight Booking - Successful Booking
`;
const fiveResult = parseBulkText(fiveItemsInput, []);
console.log(`Parsed ${fiveResult.validPoints.length} points (expected 5).`);
console.log('Points:', fiveResult.validPoints);
if (fiveResult.validPoints.length !== 5) throw new Error('Expected 5 valid points');

// 3. User Prompt Example (9 items) + additional items to reach 20
console.log('\n--- 3. 20 Checklist Items Test ---');
const twentyItemsInput = `
Bus Booking - Successful Booking
Bus Booking - Failed Booking
Bus Booking - Cancellation
Hotel Booking - Successful Booking
Hotel Booking - Failed Booking
Hotel Booking - Cancellation
Flight Booking - Successful Booking
Flight Booking - Failed Booking
Flight Booking - Cancellation
10. Train Booking - Successful Booking
11. Train Booking - PNR Status Check
12. Train Booking - Tatkal Booking Flow
13. Payment Gateway - UPI Flow
14. Payment Gateway - Credit Card Flow
15. Payment Gateway - Netbanking Flow
16. Refund Module - Immediate Refund
17. Refund Module - Failed Refund Retry
18. Notifications - SMS Confirmation
19. Notifications - Email Invoice
20. Profile Module - Saved Travelers List
`;
const twentyResult = parseBulkText(twentyItemsInput, []);
console.log(`Parsed ${twentyResult.validPoints.length} points (expected 20).`);
if (twentyResult.validPoints.length !== 20) throw new Error(`Expected 20 valid points, got ${twentyResult.validPoints.length}`);

// 4. 50 Items Performance Benchmark
console.log('\n--- 4. 50 Checklist Items & Performance Benchmark ---');
const lines50: string[] = [];
for (let i = 1; i <= 50; i++) {
  lines50.push(`${i}. Automated Verification Point #${i} - Service Health & Flow`);
}
const fiftyInput = lines50.join('\r\n'); // Test Windows CRLF line endings
const startTime = performance.now();
const fiftyResult = parseBulkText(fiftyInput, []);
const duration = performance.now() - startTime;
console.log(`Parsed ${fiftyResult.validPoints.length} points in ${duration.toFixed(3)}ms (expected 50).`);
if (fiftyResult.validPoints.length !== 50) throw new Error('Expected 50 valid points');

// 5. Duplicate Detection Tests
console.log('\n--- 5. Duplicate Detection Tests ---');
const duplicatePastedInput = `
Bus Booking - Successful Booking
bus booking - successful booking
• Bus Booking - Successful Booking
Hotel Booking - New Flow
Hotel Booking - New Flow
Flight Booking - One
`;
const dupPastedResult = parseBulkText(duplicatePastedInput, []);
console.log('Valid unique points:', dupPastedResult.validPoints.length, dupPastedResult.validPoints);
console.log('Duplicates in pasted:', dupPastedResult.duplicatesInPasted.length, dupPastedResult.duplicatesInPasted);
if (dupPastedResult.validPoints.length !== 3) throw new Error(`Expected 3 unique points, got ${dupPastedResult.validPoints.length}`);
if (dupPastedResult.duplicatesInPasted.length !== 2) throw new Error(`Expected 2 duplicate points, got ${dupPastedResult.duplicatesInPasted.length}`);

// 6. Duplicate against existing checklist items in form
console.log('\n--- 6. Duplicate against Existing Form Items Test ---');
const existingItems: ChangeChecklistItem[] = [
  { id: '1', text: 'Bus Booking - Successful Booking', type: 'manual', status: 'Pending' },
  { id: '2', text: 'TASK-000100 - Authentication Flow', taskTitle: 'Authentication Flow', type: 'task', status: 'Completed' },
];
const inputWithExistingDupes = `
Bus Booking - Successful Booking
bus booking - successful booking
AUTHENTICATION FLOW
New Unique Feature - Verified
`;
const existingDupResult = parseBulkText(inputWithExistingDupes, existingItems);
console.log('Valid points:', existingDupResult.validPoints.length, existingDupResult.validPoints);
console.log('Duplicates from existing:', existingDupResult.duplicatesInExisting.length, existingDupResult.duplicatesInExisting);
if (existingDupResult.validPoints.length !== 1 || existingDupResult.validPoints[0] !== 'New Unique Feature - Verified') {
  throw new Error('Existing duplicate check failed');
}

console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
