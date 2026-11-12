import { createPartnerApiKey, verifyStrideIqPartnerRequest, buildStrideIqCorsHeaders } from '../src/lib/server/strideiqStore';
import { NextRequest } from 'next/server';

async function runFamioTests() {
  console.log('=== Step 1: Issue Famio.us Partner API Key ===');
  const { apiKey, record } = await createPartnerApiKey({
    label: 'Famio.us Social Platform Production',
    createdBy: 'admin@chancetekone.com',
    appType: 'social',
  });
  console.log('Issued Famio Key:', apiKey);
  console.log('Key Details:', {
    id: record.id,
    label: record.label,
    prefix: record.prefix,
    appType: record.appType,
  });

  if (!apiKey.startsWith('sk_famio_')) {
    throw new Error(`Expected Famio key prefix sk_famio_, got ${apiKey}`);
  }

  console.log('\n=== Step 2: Validate Famio.us CORS Headers ===');
  const famioReq = new NextRequest('https://chancetekone.us/api/v1/tracks?q=Nas', {
    headers: {
      origin: 'https://famio.us',
      'x-famio-api-key': apiKey,
    },
  });
  const corsHeaders = buildStrideIqCorsHeaders(famioReq);
  console.log('CORS Allow Origin:', corsHeaders['Access-Control-Allow-Origin']);
  console.log('CORS Allow Headers:', corsHeaders['Access-Control-Allow-Headers']);
  console.log('Platform Header:', corsHeaders['X-Partner-Platform']);

  if (corsHeaders['Access-Control-Allow-Origin'] !== 'https://famio.us') {
    throw new Error('CORS header for https://famio.us was not correctly set!');
  }

  console.log('\n=== Step 3: Validate Authentication via x-famio-api-key and x-api-key ===');
  const auth1 = await verifyStrideIqPartnerRequest(famioReq);
  console.log('x-famio-api-key Auth Result:', auth1.authorized, 'Type:', auth1.authType);
  if (!auth1.authorized) {
    throw new Error('Auth via x-famio-api-key failed!');
  }

  const universalReq = new NextRequest('https://chancetekone.us/api/v1/tracks', {
    headers: {
      origin: 'https://app.famio.us',
      'x-api-key': apiKey,
    },
  });
  const auth2 = await verifyStrideIqPartnerRequest(universalReq);
  console.log('x-api-key Auth Result:', auth2.authorized, 'Type:', auth2.authType);
  if (!auth2.authorized) {
    throw new Error('Auth via x-api-key failed!');
  }

  console.log('\n=== Step 4: Verify Universal /api/v1/tracks route ===');
  const { GET: tracksGet } = await import('../src/app/api/v1/tracks/route');
  const trackReq = new NextRequest('https://chancetekone.us/api/v1/tracks?q=Nas&limit=5', {
    headers: {
      origin: 'https://famio.us',
      'x-api-key': apiKey,
    },
  });
  const tracksRes = await tracksGet(trackReq);
  const tracksData = await tracksRes.json();
  console.log('Tracks status:', tracksRes.status);
  console.log('Tracks total returned:', tracksData.total);
  if (!tracksData.ok || tracksData.total < 1) {
    throw new Error('Tracks endpoint failed to return Nas tracks!');
  }
  const sampleTrack = tracksData.tracks[0];
  console.log('Sample Nas Track:', sampleTrack.title, 'by', sampleTrack.artist);
  console.log('Stream URL:', sampleTrack.streamUrl);
  if (!sampleTrack.streamUrl || !sampleTrack.streamUrl.includes('token=')) {
    throw new Error('Sample track missing pre-signed streamUrl token!');
  }

  console.log('\n=== Step 5: Verify Universal /api/v1/audiobooks route ===');
  const { GET: audiobooksGet } = await import('../src/app/api/v1/audiobooks/route');
  const abReq = new NextRequest('https://chancetekone.us/api/v1/audiobooks?limit=10', {
    headers: {
      origin: 'https://famio.us',
      'x-api-key': apiKey,
    },
  });
  const abRes = await audiobooksGet(abReq);
  const abData = await abRes.json();
  console.log('Audiobooks status:', abRes.status);
  console.log('Total Audiobooks:', abData.total);
  if (!abData.ok || abData.total < 1) {
    throw new Error('Audiobooks endpoint returned zero books!');
  }
  const sampleBook = abData.audiobooks[0];
  console.log('Sample Audiobook:', `"${sampleBook.title}" by ${sampleBook.author} (${sampleBook.chapters?.length || 0} chapters)`);

  console.log('\n=== Step 6: Verify Universal /api/v1/sync Live Sync route ===');
  const { GET: syncGet } = await import('../src/app/api/v1/sync/route');
  const syncReq = new NextRequest('https://chancetekone.us/api/v1/sync', {
    headers: {
      origin: 'https://famio.us',
      'x-famio-api-key': apiKey,
    },
  });
  const syncRes = await syncGet(syncReq);
  const syncData = await syncRes.json();
  console.log('Sync status:', syncRes.status);
  console.log('Sync ok:', syncData.ok);
  console.log('Sync counts:', JSON.stringify(syncData.counts));
  if (!syncData.ok || syncData.counts.totalMusicTracks < 50) {
    throw new Error('Live sync returned fewer than 50 tracks!');
  }

  console.log('\n=== Step 7: Verify Range Streaming /api/v1/stream/[trackId] with HTTP 206 ===');
  const { GET: streamGet } = await import('../src/app/api/v1/stream/[trackId]/route');
  const streamUrlObj = new URL(sampleTrack.streamUrl);
  const streamToken = streamUrlObj.searchParams.get('token');
  const streamReq = new NextRequest(`https://chancetekone.us/api/v1/stream/${sampleTrack.id}?token=${streamToken}`, {
    headers: {
      origin: 'https://famio.us',
      range: 'bytes=0-1024',
    },
  });
  const streamRes = await streamGet(streamReq, { params: Promise.resolve({ trackId: sampleTrack.id }) });
  console.log('Stream status:', streamRes.status);
  console.log('Content-Range:', streamRes.headers.get('content-range'));
  console.log('Content-Type:', streamRes.headers.get('content-type'));
  if (streamRes.status !== 206) {
    throw new Error(`Expected HTTP 206 Partial Content for range request, got ${streamRes.status}`);
  }

  console.log('\n=== Step 8: Verify Universal Discovery Root /api/v1 ===');
  const { GET: v1RootGet } = await import('../src/app/api/v1/route');
  const rootReq = new NextRequest('https://chancetekone.us/api/v1', {
    headers: { origin: 'https://famio.us' },
  });
  const rootRes = await v1RootGet(rootReq);
  const rootData = await rootRes.json();
  console.log('V1 Discovery Root platform:', rootData.platform);
  console.log('V1 Partners supported:', rootData.partners);
  if (!rootData.ok || !rootData.endpoints.tracks) {
    throw new Error('V1 Root Discovery failed!');
  }

  console.log('\n=== SUCCESS: ALL FAMIO.US INTEGRATION & STREAMING TESTS PASSED (100%) ===');
}

runFamioTests().catch((err) => {
  console.error('Famio integration test failed:', err);
  process.exit(1);
});
