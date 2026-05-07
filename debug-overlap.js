/**
 * Debug script to test overlap detection logic
 */

function testOverlapLogic() {
  console.log('=== OVERLAP DETECTION DEBUG ===\n');
  
  // Test case: Your actual scenario
  const existing = { start_time: "16:30", end_time: "18:05" };
  const newShowtime = { start_time: "18:00", end_time: "19:35" };
  
  console.log('Existing showtime:', existing);
  console.log('New showtime:', newShowtime);
  console.log('');
  
  // Current MongoDB query logic
  console.log('MongoDB Query Conditions:');
  console.log(`start_time: { $lt: "${newShowtime.end_time}" }`);
  console.log(`end_time: { $gt: "${newShowtime.start_time}" }`);
  console.log('');
  
  // Test the conditions
  const condition1 = existing.start_time < newShowtime.end_time; // "16:30" < "19:35"
  const condition2 = existing.end_time > newShowtime.start_time; // "18:05" > "18:00"
  
  console.log('Condition 1 (existing.start_time < new.end_time):');
  console.log(`"${existing.start_time}" < "${newShowtime.end_time}" = ${condition1}`);
  
  console.log('Condition 2 (existing.end_time > new.start_time):');
  console.log(`"${existing.end_time}" > "${newShowtime.start_time}" = ${condition2}`);
  
  console.log('');
  console.log('Both conditions true = OVERLAP DETECTED:', condition1 && condition2);
  
  if (condition1 && condition2) {
    console.log('✅ CORRECT: System should BLOCK this showtime');
  } else {
    console.log('❌ BUG: System would ALLOW this showtime');
  }
  
  console.log('');
  console.log('=== VISUAL TIMELINE ===');
  console.log('16:30 -------- 18:05 (Existing)');
  console.log('         18:00 -------- 19:35 (New)');
  console.log('         ^^^^^ OVERLAP (18:00-18:05)');
  
  // Test string comparison behavior
  console.log('\n=== STRING COMPARISON TEST ===');
  console.log('"18:05" > "18:00":', "18:05" > "18:00");
  console.log('"16:30" < "19:35":', "16:30" < "19:35");
  
  // Test edge cases
  console.log('\n=== EDGE CASES ===');
  testCase("16:30", "18:00", "18:00", "19:30", "Adjacent (no overlap)");
  testCase("16:30", "18:05", "18:00", "19:30", "5-minute overlap");
  testCase("16:30", "18:30", "18:00", "19:30", "30-minute overlap");
  testCase("16:30", "19:00", "18:00", "19:30", "60-minute overlap");
}

function testCase(start1, end1, start2, end2, description) {
  const condition1 = start1 < end2;
  const condition2 = end1 > start2;
  const overlap = condition1 && condition2;
  
  console.log(`${description}:`);
  console.log(`  ${start1}-${end1} vs ${start2}-${end2}`);
  console.log(`  Overlap: ${overlap ? 'YES' : 'NO'}`);
}

// Run the test
testOverlapLogic();