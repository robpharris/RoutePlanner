// Free OSRM: Driving distances/times (no key, handles one-ways/highways)
export async function getOSRMMatrix(points) {
  if (points.length === 0) return [];
  const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/table/v1/driving/${coords}?annotations=duration`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('OSRM fetch failed');
    const data = await res.json();
    return data.durations;  // [[0, 120, 300], ...] in seconds
  } catch (e) {
    console.warn('OSRM failed—falling back to Haversine:', e);
    // Haversine fallback (straight-line seconds approx)
    return points.map((p1, i) => 
      points.map((p2, j) => 
        i === j ? 0 : haversine(p1, p2) * 1000 / 60  // km to seconds @ 60km/h
      )
    );
  }
}

// Haversine helper
function haversine(p1, p2) {
  const toRad = x => x * Math.PI / 180;
  const R = 6371; // km
  const dLat = toRad(p2.lat - p1.lat);
  const dLon = toRad(p2.lng - p1.lng);
  const lat1 = toRad(p1.lat), lat2 = toRad(p2.lat);
  return 2 * R * Math.asin(Math.sqrt(
    Math.sin(dLat/2)**2 + Math.sin(dLon/2)**2 * Math.cos(lat1) * Math.cos(lat2)
  ));
}