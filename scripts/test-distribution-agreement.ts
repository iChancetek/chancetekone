import assert from 'assert';
import { DistributionAgreementService } from '../src/lib/agreements/DistributionAgreementService';
import { AuditLogger } from '../src/lib/admin/AuditLogger';

async function runTests() {
  console.log('\n--- Test 1: Agreement Registration ID Generation ---');
  const id1 = DistributionAgreementService.generateAgreementId();
  const id2 = DistributionAgreementService.generateAgreementId();
  console.log('Sample ID 1:', id1);
  console.log('Sample ID 2:', id2);
  assert(id1.startsWith('AGR-8SP-'), 'Agreement ID must follow standard institutional prefix');
  assert.notStrictEqual(id1, id2, 'Agreement IDs must be unique');
  console.log('  ✓ Agreement ID generation conforms to specification');

  console.log('\n--- Test 2: Institutional Execution & Countersignature ---');
  assert.strictEqual(DistributionAgreementService.COUNTERSIGNED_BY, 'Chancellor @ 8 OF SPADES WORKS LLC');
  assert.strictEqual(DistributionAgreementService.COUNTERSIGNED_TITLE, 'Executive Director & Rights Curator');
  assert.strictEqual(DistributionAgreementService.VERSION, '1.0.0');
  console.log('  ✓ Institutional countersignatory credentials verified');

  console.log('\n--- Test 3: Agreement Submission Simulation ---');
  const samplePayload = {
    artistLegalName: 'Marcus Aurelius Vance',
    artistMoniker: 'Vance The Break Master',
    entityName: 'Vance Audio Holdings LLC',
    email: 'marcus@vanceaudio.com',
    phone: '+1 (212) 555-0199',
    address: '142 W 57th St',
    city: 'New York',
    state: 'NY',
    postalCode: '10019',
    country: 'United States',
    w9Certified: true,
    paymentProvider: 'stripe_connect' as const,
    signatureType: 'crypto_typed' as const,
    signatureData: 'Marcus Aurelius Vance',
    signedDate: 'October 26, 2026',
    contentTypesDeclared: ['music' as const, 'video' as const],
  };

  const initialLogCount = AuditLogger.getLogs().length;
  const agreement = await DistributionAgreementService.submitAgreement(samplePayload);

  assert(agreement.id.startsWith('AGR-8SP-'), 'Generated agreement must have valid ID');
  assert.strictEqual(agreement.artistLegalName, samplePayload.artistLegalName);
  assert.strictEqual(agreement.status, 'submitted');
  assert.strictEqual(agreement.countersignedBy, DistributionAgreementService.COUNTERSIGNED_BY);
  assert(agreement.submittedAt.length > 0, 'Must record submission timestamp');
  console.log('  ✓ Distribution Agreement successfully executed and registered with ID:', agreement.id);

  const newLogCount = AuditLogger.getLogs().length;
  assert(newLogCount > initialLogCount, 'Submission must trigger audit trail record');
  console.log('  ✓ AuditLogger recorded agreement submission event');

  console.log('\n--- Test 4: Agreement Status Transition & Approval ---');
  const updated = DistributionAgreementService.updateAgreementStatus(
    agreement.id,
    'verified_active',
    'Verified via Stripe Connect onboarding'
  );
  assert.strictEqual(updated, true);

  const found = DistributionAgreementService.getSubmittedAgreements().find(
    (a) => a.id === agreement.id
  );
  assert(found !== undefined, 'Agreement must be retrievable from registry');
  assert.strictEqual(found.status, 'verified_active');
  assert.strictEqual(found.adminNotes, 'Verified via Stripe Connect onboarding');
  console.log('  ✓ Admin status transition to "verified_active" successfully logged');

  console.log('\nAll 4 tests passed successfully!\n');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
