import { createPartnerApiKey, verifyStrideIqPartnerRequest, listPartnerApiKeys } from '../src/lib/server/strideiqStore';
import { queryStrideIqTracks, generateStrideIqWorkoutMix, resolvePlayableStreamAsset, resolveServerAudiobooks, resolveServerPodcasts } from '../src/lib/server/strideiqCatalog';
import { NextRequest } from 'next/server';

async function runTest() {
  console.log('=== Step 1: Issue StrideIQ Partner API Key ===');
  const { apiKey, record } = await createPartnerApiKey({
    label: 'StrideIQ.fit Production Athlete Suite',
    createdBy: 'admin@chancetekone.com',
  });
  console.log('Issued Partner Key:', apiKey);
  console.log('Key Record:', record.label, record.id, record.prefix);

  console.log('\n=== Step 2: Validate API Key Authentication ===');
  const req = new NextRequest('https://chancetekone.us/api/strideiq/v1/tracks?q=Nas', {
    headers: {
      'x-strideiq-api-key': apiKey,
    },
  });
  const auth = await verifyStrideIqPartnerRequest(req);
  console.log('Auth check passed:', auth.authorized, 'Auth type:', auth.authType, 'Partner Key ID:', auth.partnerKeyId);
  if (!auth.authorized) {
    throw new Error('API key auth failed!');
  }

  console.log('\n=== Step 3: Query StrideIQ Tracks for "Nas" ===');
  const tracksResult = await queryStrideIqTracks({
    publicOrigin: 'https://chancetekone.us',
    q: 'Nas',
  });
  console.log('Total Nas tracks returned to API key caller:', tracksResult.total);
  if (tracksResult.total === 0) {
    throw new Error('FAILED: StrideIQ does not see Nas music!');
  }

  for (const track of tracksResult.tracks) {
    console.log(`[NAS] ${track.title} | BPM: ${track.bpm} | Playable: ${track.playable} | Stream: ${track.streamUrl}`);
    const asset = await resolvePlayableStreamAsset(track.id);
    if (!asset || !asset.playable) {
      throw new Error(`FAILED: Track ${track.title} (${track.id}) is not playable!`);
    }
    console.log(`  -> Verified playable stream file: ${asset.localFilePath}`);
  }

  console.log('\n=== Step 4: Generate Cadence-Matched Workout Mix ===');
  const runningMix = await generateStrideIqWorkoutMix({
    publicOrigin: 'https://chancetekone.us',
    activity: 'running',
    mediaMode: 'music',
    targetDurationMinutes: 30,
    cadenceSpm: 168,
  });
  console.log('Running Mix Generated:');
  console.log('Tracks in Mix:', runningMix.trackCount, 'Duration:', runningMix.actualDurationSeconds, 'sec');
  console.log('Average BPM:', runningMix.averageBpm);

  console.log('\n=== Step 5: Verify Audiobooks Real-Time Querying ===');
  const audiobooks = await resolveServerAudiobooks();
  console.log('Total Audiobooks returned:', audiobooks.length);
  for (const ab of audiobooks) {
    console.log(`- Audiobook: "${ab.title}" by ${ab.author} (${ab.chapters.length} chapters, ${ab.totalDurationSeconds}s)`);
  }

  console.log('\n=== Step 6: Verify Podcasts Real-Time Querying ===');
  const podcasts = await resolveServerPodcasts();
  console.log('Total Podcasts returned:', podcasts.length);

  console.log('\n=== Step 7: Verify Live Sync Route (/api/strideiq/v1/sync) ===');
  const { GET: syncGet } = await import('../src/app/api/strideiq/v1/sync/route');
  const syncReq = new NextRequest(`https://chancetekone.us/api/strideiq/v1/sync`, {
    headers: {
      'x-strideiq-api-key': apiKey,
    },
  });
  const syncRes = await syncGet(syncReq);
  const syncData = await syncRes.json();
  console.log('Sync Response Status:', syncRes.status);
  console.log('Sync Response OK:', syncData.ok);
  console.log('Sync Response Mode:', syncData.syncMode);
  console.log('Sync Counts:', JSON.stringify(syncData.counts));
  if (!syncData.ok || syncData.counts.totalMusicTracks < 50) {
    throw new Error(`FAILED: Live Sync returned ${syncData.counts?.totalMusicTracks} tracks!`);
  }

  console.log('\n=== Step 8: Verify Query Parameter API Key Auth (?api_key=...) ===');
  const queryAuthReq = new NextRequest(`https://chancetekone.us/api/strideiq/v1/sync?api_key=${encodeURIComponent(apiKey)}`);
  const queryAuth = await verifyStrideIqPartnerRequest(queryAuthReq);
  console.log('Query auth passed:', queryAuth.authorized, 'Auth type:', queryAuth.authType);
  if (!queryAuth.authorized) {
    throw new Error('FAILED: Query parameter API key auth failed!');
  }

  console.log('\n=== ALL REAL-TIME API KEY & NAS CHECKS PASSED WITH 100% SUCCESS ===');
}

runTest().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});

