interface Address {
  id: string;
  address: string;
  latitude?: number;
  longitude?: number;
  name?: string;
  notes?: string;
}

export class NavigationService {
  generateNavigationUrls(route: Address[]): { googleMaps: string; waze: string } {
    if (route.length === 0) {
      return { googleMaps: '', waze: '' };
    }

    const googleMapsUrl = this.generateGoogleMapsUrl(route);
    const wazeUrl = this.generateWazeUrl(route);

    return {
      googleMaps: googleMapsUrl,
      waze: wazeUrl
    };
  }

  generateGoogleMapsUrl(route: Address[], startIndex: number = 0): string {
    if (route.length === 0) return '';

    const baseUrl = 'https://www.google.com/maps/dir/';
    const waypoints: string[] = [];

    // Add all addresses as waypoints
    for (let i = startIndex; i < route.length; i++) {
      const address = route[i];
      if (address.latitude && address.longitude) {
        waypoints.push(`${address.latitude},${address.longitude}`);
      } else {
        waypoints.push(encodeURIComponent(address.address));
      }
    }

    // If starting from middle of route, add remaining addresses
    if (startIndex > 0) {
      for (let i = 0; i < startIndex; i++) {
        const address = route[i];
        if (address.latitude && address.longitude) {
          waypoints.push(`${address.latitude},${address.longitude}`);
        } else {
          waypoints.push(encodeURIComponent(address.address));
        }
      }
    }

    return baseUrl + waypoints.join('/');
  }

  generateWazeUrl(route: Address[], startIndex: number = 0): string {
    if (route.length === 0) return '';

    // Waze doesn't support multi-stop routes in URL, so we'll navigate to the next stop
    const nextStop = route[startIndex] || route[0];
    
    if (nextStop.latitude && nextStop.longitude) {
      return `https://waze.com/ul?ll=${nextStop.latitude},${nextStop.longitude}&navigate=yes`;
    } else {
      return `https://waze.com/ul?q=${encodeURIComponent(nextStop.address)}&navigate=yes`;
    }
  }

  generateAppleMapsUrl(route: Address[], startIndex: number = 0): string {
    if (route.length === 0) return '';

    const nextStop = route[startIndex] || route[0];
    
    if (nextStop.latitude && nextStop.longitude) {
      return `http://maps.apple.com/?daddr=${nextStop.latitude},${nextStop.longitude}`;
    } else {
      return `http://maps.apple.com/?daddr=${encodeURIComponent(nextStop.address)}`;
    }
  }
}