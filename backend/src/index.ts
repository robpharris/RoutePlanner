import express from 'express';
import cors from 'cors';
import multer from 'multer';
import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
// Temporarily disable RouteOptimizer to isolate server crash
// import { RouteOptimizer } from './services/RouteOptimizer';
import { NavigationService } from './services/NavigationService';
import { RouteStorageService } from './services/RouteStorageService';
import { AddressAutocompleteService } from './services/AddressAutocompleteService';

dotenv.config();

const app = express();
const port = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept CSV and Excel files
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/csv'
    ];
    
    if (allowedTypes.includes(file.mimetype) || 
        file.originalname.match(/\.(csv|xls|xlsx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  }
});

// Types
interface Address {
  id: string;
  address: string;
  latitude?: number;
  longitude?: number;
  name?: string;
  notes?: string;
  status?: 'pending' | 'completed' | 'skipped';
  completedAt?: string;
  skippedAt?: string;
}

interface RouteResponse {
  optimizedRoute: Address[];
  totalDistance: number;
  estimatedTime: number;
  navigationUrls: {
    googleMaps: string;
    waze: string;
  };
}

// File parsing utility
async function parseAddressFile(filePath: string, filename: string, defaultCity?: string, defaultState?: string): Promise<{addresses: Address[], needsCityState: boolean}> {
  const addresses: Address[] = [];
  const fileExtension = path.extname(filename).toLowerCase();
  let needsCityState = false;

  const parseAndProcess = (data: any[]) => {
    // Debug: Log the first row's keys to see actual column names
    if (data.length > 0) {
      console.log('Actual column names found:', Object.keys(data[0]));
      console.log('First row sample:', data[0]);
    }
    
    data.forEach((row: any) => {
      const address = parseAddressRow(row);
      if (address.address) {
        // Check if address needs city/state completion
        const hasFullAddress = address.address.includes(',') && 
                              (address.address.match(/[A-Z]{2}\s+\d{5}/) || // State + Zip
                               address.address.includes(' IL ') || 
                               address.address.includes(' CA ') ||
                               address.address.includes(' TX ') ||
                               address.address.includes(' NY ') ||
                               address.address.includes(' FL '));

        if (!hasFullAddress && (defaultCity || defaultState)) {
          // Add default city and state if provided
          let enhancedAddress = address.address;
          if (defaultCity && !address.address.toLowerCase().includes(defaultCity.toLowerCase())) {
            enhancedAddress += `, ${defaultCity}`;
          }
          if (defaultState && !address.address.includes(defaultState)) {
            enhancedAddress += `, ${defaultState}`;
          }
          address.address = enhancedAddress;
        } else if (!hasFullAddress) {
          needsCityState = true;
        }

        addresses.push(address);
      }
    });
  };

  if (fileExtension === '.csv') {
    // Parse CSV file
    return new Promise<{addresses: Address[], needsCityState: boolean}>((resolve, reject) => {
      const rows: any[] = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', () => {
          parseAndProcess(rows);
          resolve({ addresses, needsCityState });
        })
        .on('error', reject);
    });
  } else if (['.xls', '.xlsx'].includes(fileExtension)) {
    // Parse Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    parseAndProcess(jsonData);
    return { addresses, needsCityState };
  } else {
    throw new Error('Unsupported file format');
  }
}

// Flexible row parsing for different column name variations
function parseAddressRow(row: any): Address {
  // Try multiple column name variations
  const getField = (variations: string[]) => {
    for (const variation of variations) {
      if (row[variation] !== undefined && row[variation] !== '') {
        return String(row[variation]).trim();
      }
    }
    return '';
  };

  // Check if this is a delivery format (St Num, St Name, Zip pattern)
  const streetNumber = getField(['St Num', 'st num', 'street number', 'house number', 'number']);
  const streetName = getField(['St Name', 'St Nam', 'st name', 'st nam', 'street name', 'street']);
  const apartment = getField(['APT#', 'Apt #', 'apt#', 'apt', 'apartment', 'unit', 'suite']);
  const zipCode = getField(['Zip', 'zip', 'zipcode', 'postal code']);

  let assembledAddress = '';
  
  if (streetNumber && streetName) {
    // Assemble address from delivery format components
    assembledAddress = `${streetNumber} ${streetName}`;
    if (apartment) {
      assembledAddress += `, ${apartment}`;
    }
    if (zipCode) {
      assembledAddress += `, ${zipCode}`;
    }
  }

  // Fallback to standard address field if delivery format not found
  const standardAddress = getField([
    'address', 'Address', 'ADDRESS',
    'street', 'Street', 'STREET', 
    'location', 'Location', 'LOCATION',
    'delivery_address', 'Delivery Address', 'DeliveryAddress',
    'full_address', 'Full Address', 'FullAddress'
  ]);

  const finalAddress = assembledAddress || standardAddress;

  // Enhanced name field detection including publication names
  const name = getField([
    'name', 'Name', 'NAME',
    'customer', 'Customer', 'CUSTOMER',
    'client', 'Client', 'CLIENT',
    'company', 'Company', 'COMPANY',
    'customer_name', 'Customer Name', 'CustomerName',
    'business_name', 'Business Name', 'BusinessName',
    'Product', 'product', 'PRODUCT',
    'pub', 'Pub', 'publication', 'Publication'
  ]);

  // Enhanced notes including delivery-specific fields
  const frequency = getField(['Freq', 'freq', 'frequency', 'Frequency']);
  const quantity = getField(['QTY', 'qty', 'quantity', 'Quantity', 'count']);
  const deliveryType = getField(['Type', 'type', 'delivery_type', 'category']);
  const standardNotes = getField([
    'notes', 'Notes', 'NOTES',
    'comments', 'Comments', 'COMMENTS',
    'instructions', 'Instructions', 'INSTRUCTIONS',
    'delivery_notes', 'Delivery Notes', 'DeliveryNotes',
    'special_instructions', 'Special Instructions', 'SpecialInstructions',
    'remarks', 'Remarks', 'REMARKS'
  ]);

  // Assemble delivery notes
  let notes = standardNotes;
  if (frequency || quantity || deliveryType) {
    const deliveryInfo = [];
    if (frequency) deliveryInfo.push(`Frequency: ${frequency}`);
    if (quantity) deliveryInfo.push(`Quantity: ${quantity}`);
    if (deliveryType) deliveryInfo.push(`Type: ${deliveryType}`);
    notes = notes ? `${notes} | ${deliveryInfo.join(', ')}` : deliveryInfo.join(', ');
  }

  return {
    id: getField(['id', 'ID', 'Id']) || Math.random().toString(36).substr(2, 9),
    address: finalAddress,
    name: name,
    notes: notes,
    status: 'pending'
  };
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post('/api/upload-addresses', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const filename = req.file.originalname;

    // Parse file (CSV or Excel) using unified parser
    const { addresses, needsCityState } = await parseAddressFile(filePath, filename);

    // Debug logging - let's see what we actually received
    console.log(`\n=== DEBUG: Parsing ${filename} ===`);
    console.log('File extension:', path.extname(filename));
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);

    if (addresses.length === 0) {
      return res.status(400).json({ 
        error: `No valid addresses found in ${path.extname(filename).toUpperCase()} file. Please check column names.`,
        supportedColumns: {
          standard: ['address', 'name', 'notes'],
          delivery: ['Product', 'Freq', 'QTY', 'St Num', 'St Name', 'APT#', 'Zip', 'Type'],
          flexible: 'Most column name variations are automatically detected'
        }
      });
    }

    console.log(`Successfully parsed ${addresses.length} addresses from ${filename}`);

    res.json({
      message: `Addresses uploaded successfully from ${filename}`,
      count: addresses.length,
      addresses: addresses,
      fileType: path.extname(filename).toLowerCase(),
      needsCityState: needsCityState,
      suggestion: needsCityState ? 'Some addresses may need city/state information for better routing accuracy' : undefined
    });

  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ 
      error: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
  }
});

// Complete addresses with city/state information
app.post('/api/complete-addresses', async (req, res) => {
  try {
    const { addresses, city, state } = req.body;

    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Addresses array required' });
    }

    if (!city || !state) {
      return res.status(400).json({ error: 'City and state required' });
    }

    const completedAddresses = addresses.map((addr: Address) => {
      let enhancedAddress = addr.address;
      
      // Add city if not already present
      if (!enhancedAddress.toLowerCase().includes(city.toLowerCase())) {
        enhancedAddress += `, ${city}`;
      }
      
      // Add state if not already present  
      if (!enhancedAddress.includes(state)) {
        enhancedAddress += `, ${state}`;
      }

      return {
        ...addr,
        address: enhancedAddress
      };
    });

    res.json({
      message: 'Addresses completed successfully',
      addresses: completedAddresses,
      city,
      state
    });

  } catch (error) {
    console.error('Error completing addresses:', error);
    res.status(500).json({ error: 'Failed to complete addresses' });
  }
});

app.post('/api/optimize-route', async (req, res) => {
  try {
    const { addresses, startLocation } = req.body;

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ error: 'No addresses provided' });
    }

    // Temporarily disable RouteOptimizer to test server stability
    // const routeOptimizer = new RouteOptimizer();
    const navigationService = new NavigationService();

    // Mock optimization for testing
    console.log('📍 Processing addresses (RouteOptimizer disabled for testing)');
    const geocodedAddresses = addresses; // Skip geocoding for now
    const optimizedRoute = addresses; // Use original order
    const totalDistance = 10.5; // Mock values
    const estimatedTime = 30;
    
    // Generate navigation URLs
    const navigationUrls = navigationService.generateNavigationUrls(optimizedRoute);

    const response: RouteResponse = {
      optimizedRoute,
      totalDistance,
      estimatedTime,
      navigationUrls
    };

    res.json(response);

  } catch (error) {
    console.error('Error optimizing route:', error);
    res.status(500).json({ error: 'Failed to optimize route' });
  }
});

app.get('/api/navigation/:service/:stopIndex', (req, res) => {
  try {
    const { service, stopIndex } = req.params;
    const { addresses } = req.query;

    if (!addresses) {
      return res.status(400).json({ error: 'Addresses parameter required' });
    }

    const parsedAddresses = JSON.parse(addresses as string);
    const navigationService = new NavigationService();
    
    let url: string;
    const stopIndex_num = parseInt(stopIndex);

    if (service === 'google-maps') {
      url = navigationService.generateGoogleMapsUrl(parsedAddresses, stopIndex_num);
    } else if (service === 'waze') {
      url = navigationService.generateWazeUrl(parsedAddresses, stopIndex_num);
    } else {
      return res.status(400).json({ error: 'Invalid navigation service' });
    }

    res.json({ url });

  } catch (error) {
    console.error('Error generating navigation URL:', error);
    res.status(500).json({ error: 'Failed to generate navigation URL' });
  }
});

// Route Management Endpoints
const routeStorage = new RouteStorageService();

app.get('/api/routes', (req, res) => {
  try {
    const routes = routeStorage.getAllRoutes();
    res.json(routes);
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

app.get('/api/routes/:routeId', (req, res) => {
  try {
    const route = routeStorage.getRoute(req.params.routeId);
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }
    res.json(route);
  } catch (error) {
    console.error('Error fetching route:', error);
    res.status(500).json({ error: 'Failed to fetch route' });
  }
});

app.post('/api/routes', (req, res) => {
  try {
    const { name, addresses, totalDistance, estimatedTime, currentStepIndex = 0 } = req.body;
    
    if (!name || !addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Missing required fields: name, addresses' });
    }

    const savedRoute = routeStorage.saveRoute({
      name,
      addresses: addresses.map(addr => ({ ...addr, status: addr.status || 'pending' })),
      totalDistance: totalDistance || 0,
      estimatedTime: estimatedTime || 0,
      currentStepIndex
    });

    res.status(201).json(savedRoute);
  } catch (error) {
    console.error('Error saving route:', error);
    res.status(500).json({ error: 'Failed to save route' });
  }
});

app.put('/api/routes/:routeId', (req, res) => {
  try {
    const updatedRoute = routeStorage.updateRoute(req.params.routeId, req.body);
    if (!updatedRoute) {
      return res.status(404).json({ error: 'Route not found' });
    }
    res.json(updatedRoute);
  } catch (error) {
    console.error('Error updating route:', error);
    res.status(500).json({ error: 'Failed to update route' });
  }
});

app.delete('/api/routes/:routeId', (req, res) => {
  try {
    const deleted = routeStorage.deleteRoute(req.params.routeId);
    if (!deleted) {
      return res.status(404).json({ error: 'Route not found' });
    }
    res.json({ message: 'Route deleted successfully' });
  } catch (error) {
    console.error('Error deleting route:', error);
    res.status(500).json({ error: 'Failed to delete route' });
  }
});

// Stop Management Endpoints
app.post('/api/routes/:routeId/stops', (req, res) => {
  try {
    const { address, insertIndex } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const updatedRoute = routeStorage.addStopToRoute(req.params.routeId, address, insertIndex);
    if (!updatedRoute) {
      return res.status(404).json({ error: 'Route not found' });
    }

    res.json(updatedRoute);
  } catch (error) {
    console.error('Error adding stop:', error);
    res.status(500).json({ error: 'Failed to add stop' });
  }
});

app.delete('/api/routes/:routeId/stops/:addressId', (req, res) => {
  try {
    const updatedRoute = routeStorage.removeStopFromRoute(req.params.routeId, req.params.addressId);
    if (!updatedRoute) {
      return res.status(404).json({ error: 'Route or stop not found' });
    }

    res.json(updatedRoute);
  } catch (error) {
    console.error('Error removing stop:', error);
    res.status(500).json({ error: 'Failed to remove stop' });
  }
});

app.patch('/api/routes/:routeId/stops/:addressId/status', (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'completed', 'skipped'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: pending, completed, or skipped' });
    }

    const updatedRoute = routeStorage.updateStopStatus(req.params.routeId, req.params.addressId, status);
    if (!updatedRoute) {
      return res.status(404).json({ error: 'Route or stop not found' });
    }

    res.json(updatedRoute);
  } catch (error) {
    console.error('Error updating stop status:', error);
    res.status(500).json({ error: 'Failed to update stop status' });
  }
});

app.get('/api/routes/active', (req, res) => {
  try {
    const activeRoute = routeStorage.getActiveRoute();
    if (!activeRoute) {
      return res.status(404).json({ error: 'No active route found' });
    }
    res.json(activeRoute);
  } catch (error) {
    console.error('Error fetching active route:', error);
    res.status(500).json({ error: 'Failed to fetch active route' });
  }
});

app.post('/api/routes/:routeId/activate', (req, res) => {
  try {
    const activeRoute = routeStorage.setActiveRoute(req.params.routeId);
    if (!activeRoute) {
      return res.status(404).json({ error: 'Route not found' });
    }
    res.json(activeRoute);
  } catch (error) {
    console.error('Error setting active route:', error);
    res.status(500).json({ error: 'Failed to set active route' });
  }
});

// Address Autocomplete Endpoints
const addressAutocomplete = new AddressAutocompleteService();

app.get('/api/address/suggestions', async (req, res) => {
  try {
    const { input } = req.query;
    
    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'Input parameter is required' });
    }

    if (input.length < 3) {
      return res.json([]);
    }

    const suggestions = await addressAutocomplete.getSuggestions(input);
    res.json(suggestions);
  } catch (error) {
    console.error('Error getting address suggestions:', error);
    res.status(500).json({ error: 'Failed to get address suggestions' });
  }
});

app.get('/api/address/details/:placeId', async (req, res) => {
  try {
    const details = await addressAutocomplete.getPlaceDetails(req.params.placeId);
    if (!details) {
      return res.status(404).json({ error: 'Place details not found' });
    }
    res.json(details);
  } catch (error) {
    console.error('Error getting place details:', error);
    res.status(500).json({ error: 'Failed to get place details' });
  }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Add error handling for unhandled exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

app.listen(port, () => {
  console.log(`Route Planner API server running on port ${port}`);
  console.log(`Health endpoint: http://localhost:${port}/api/health`);
  console.log(`Upload endpoint: http://localhost:${port}/api/upload-addresses`);
}).on('error', (error) => {
  console.error('💥 Server startup error:', error);
});

export default app;