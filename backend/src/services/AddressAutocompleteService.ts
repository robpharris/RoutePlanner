interface AddressSuggestion {
  placeId?: string;
  description: string;
  mainText: string;
  secondaryText: string;
  latitude?: number;
  longitude?: number;
}

export class AddressAutocompleteService {
  private googleMapsApiKey: string;
  private isGoogleAvailable: boolean;

  constructor() {
    this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    this.isGoogleAvailable = !!this.googleMapsApiKey;
  }

  async getSuggestions(input: string): Promise<AddressSuggestion[]> {
    if (input.length < 3) return [];

    // Try Google Places API first if available
    if (this.isGoogleAvailable) {
      try {
        return await this.getGooglePlacesSuggestions(input);
      } catch (error) {
        console.warn('Google Places API failed, falling back to alternative:', error);
      }
    }

    // Fallback to free alternatives
    return await this.getFreeAlternativeSuggestions(input);
  }

  private async getGooglePlacesSuggestions(input: string): Promise<AddressSuggestion[]> {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
      `input=${encodeURIComponent(input)}&` +
      `key=${this.googleMapsApiKey}&` +
      `types=address&` +
      `language=en`
    );

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data = await response.json() as any;
    
    if (data.status !== 'OK') {
      throw new Error(`Google Places API status: ${data.status}`);
    }

    return data.predictions.map((prediction: any) => ({
      placeId: prediction.place_id,
      description: prediction.description,
      mainText: prediction.structured_formatting.main_text,
      secondaryText: prediction.structured_formatting.secondary_text || ''
    }));
  }

  private async getFreeAlternativeSuggestions(input: string): Promise<AddressSuggestion[]> {
    // Try Nominatim (OpenStreetMap) - free alternative
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(input)}&` +
        `format=json&` +
        `limit=5&` +
        `addressdetails=1&` +
        `countrycodes=us,ca` // Restrict to North America for better results
      );

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const data = await response.json() as any[];
      
      return data.map((item: any) => ({
        description: item.display_name,
        mainText: this.extractMainAddress(item),
        secondaryText: this.extractSecondaryAddress(item),
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon)
      }));
    } catch (error) {
      console.warn('Free geocoding failed:', error);
      // Return basic text-based suggestions
      return this.generateBasicSuggestions(input);
    }
  }

  private extractMainAddress(nominatimResult: any): string {
    const address = nominatimResult.address;
    const houseNumber = address.house_number || '';
    const road = address.road || address.street || '';
    return `${houseNumber} ${road}`.trim();
  }

  private extractSecondaryAddress(nominatimResult: any): string {
    const address = nominatimResult.address;
    const parts = [
      address.city || address.town || address.village,
      address.state,
      address.country
    ].filter(Boolean);
    return parts.join(', ');
  }

  private generateBasicSuggestions(input: string): AddressSuggestion[] {
    // Generate basic suggestions based on common address patterns
    const suggestions: AddressSuggestion[] = [];
    
    // If input looks like a number, suggest common street types
    const numberMatch = input.match(/^\d+/);
    if (numberMatch) {
      const streetTypes = ['St', 'Ave', 'Rd', 'Blvd', 'Dr', 'Ct', 'Ln', 'Way'];
      streetTypes.forEach(type => {
        suggestions.push({
          description: `${input} ${type}`,
          mainText: `${input} ${type}`,
          secondaryText: 'Complete the address'
        });
      });
    }

    return suggestions.slice(0, 5);
  }

  async getPlaceDetails(placeId: string): Promise<AddressSuggestion | null> {
    if (!this.isGoogleAvailable || !placeId) {
      return null;
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?` +
        `place_id=${placeId}&` +
        `key=${this.googleMapsApiKey}&` +
        `fields=formatted_address,geometry`
      );

      if (!response.ok) {
        throw new Error(`Place details API error: ${response.status}`);
      }

      const data = await response.json() as any;

      if (data.status !== 'OK') {
        throw new Error(`Place details API status: ${data.status}`);
      }

      const result = data.result;
      return {
        placeId,
        description: result.formatted_address,
        mainText: result.formatted_address,
        secondaryText: '',
        latitude: result.geometry?.location?.lat,
        longitude: result.geometry?.location?.lng
      };
    } catch (error) {
      console.error('Error fetching place details:', error);
      return null;
    }
  }
}