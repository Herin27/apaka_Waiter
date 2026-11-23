const toRad = (deg) => (deg * Math.PI) / 180;

export const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const verifyCustomerGeofence = (geofence) => {
  if (!geofence?.enabled) {
    return Promise.resolve({ allowed: true });
  }

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve({
      allowed: false,
      message: 'Location services are required by this restaurant to place dine-in orders.',
    });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = calculateDistanceMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          Number(geofence.lat),
          Number(geofence.lng)
        );
        const maxRadius = Number(geofence.radiusMeters || 150);
        if (dist <= maxRadius) {
          resolve({ allowed: true, distanceMeters: Math.round(dist) });
        } else {
          resolve({
            allowed: false,
            message: `You appear to be ${Math.round(dist)}m away. Please order from inside the restaurant (within ${maxRadius}m).`,
          });
        }
      },
      () => {
        resolve({
          allowed: false,
          message: 'Please allow location permission in your browser so we can verify you are at the table.',
        });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
};
