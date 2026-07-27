import { sendSuccessResponse, sendErrorResponse } from '../../../Utils/response/responseHandler.js';
import Location from '../../../models/Location/Location.js';

export const createZoneLocation = async (req, res) => {
  try {
    const { zone, states, description, regionalManager } = req.body;

    if (!zone) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Zone is required');
    }

    const existingLocation = await Location.findOne({ zone: zone.toUpperCase(), tenantId: req.user.tenantId });
    if (existingLocation) {
      return sendErrorResponse(res, 409, 'ZONE_EXISTS', 'Location with this zone already exists');
    }

    const locationData = {
      zone: zone.toUpperCase(),
      states: states || [],
      description,
      regionalManager,
      createdBy: req.user.id,
      isActive: true,
      tenantId: req.user.tenantId,
    };

    const location = new Location(locationData);
    await location.save();

    return sendSuccessResponse(res, 201, { location }, 'Location created successfully');
  } catch (error) {
    console.error('Create location error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', messages.join(', '));
    }
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to create location');
  }
};

export const getAllLocations = async (req, res) => {
  try {
    const { zone, isActive } = req.query;
    
    const filter = {};
    if (zone) filter.zone = zone.toUpperCase();
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    filter.tenantId = req.user.tenantId;

    const locations = await Location.find(filter)
      .populate('createdBy', 'username employeeName email')
      .populate('regionalManager.refId', 'username employeeName email phone')
      .sort({ zone: 1 });

    return sendSuccessResponse(res, 200, { locations }, 'Locations retrieved successfully');
  } catch (error) {
    console.error('Get all locations error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve locations');
  }
};

export const getLocationByZone = async (req, res) => {
  try {
    const { zone } = req.params;

    const location = await Location.findOne({ _id: zone, isActive: true, tenantId: req.user.tenantId })
      .populate('createdBy', 'username employeeName email')
      .populate('regionalManager.refId', 'username employeeName email phone');

    if (!location) {
      return sendErrorResponse(res, 404, 'LOCATION_NOT_FOUND', 'Location not found');
    }

    return sendSuccessResponse(res, 200, { location }, 'Location retrieved successfully');
  } catch (error) {
    console.error('Get location by zone error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve location');
  }
};

export const addState = async (req, res) => {
  try {
    const { zone } = req.params;
    const { name, code, cities } = req.body;

    if (!name || !code) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'State name and code are required');
    }

    const location = await Location.findOne({ _id: zone, isActive: true, tenantId: req.user.tenantId });
    if (!location) {
      return sendErrorResponse(res, 404, 'LOCATION_NOT_FOUND', 'Location not found');
    }

    const existingState = location.states.find(s => s.name === name);
    if (existingState) {
      return sendErrorResponse(res, 409, 'STATE_EXISTS', 'State already exists in this zone');
    }

    location.states.push({
      name,
      code: code.toUpperCase(),
      cities: cities || [],
      isActive: true
    });

    location.updatedBy = req.user.id;
    await location.save();

    return sendSuccessResponse(res, 200, { location }, 'State added successfully');
  } catch (error) {
    console.error('Add state error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to add state');
  }
};

export const addCity = async (req, res) => {
  try {
    const { zone, stateId } = req.params;
    const { name, code, zipCodes } = req.body;

    if (!name || !code) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'City name and code are required');
    }

    const location = await Location.findOne({ _id: zone, isActive: true, tenantId: req.user.tenantId });
    if (!location) {
      return sendErrorResponse(res, 404, 'LOCATION_NOT_FOUND', 'Location not found');
    }

    const state = location.states.id(stateId);
    if (!state || !state.isActive) {
      return sendErrorResponse(res, 404, 'STATE_NOT_FOUND', 'State not found');
    }

    // Check if city already exists
    const existingCity = state.cities.find(c => c.name === name);
    if (existingCity) {
      return sendErrorResponse(res, 409, 'CITY_EXISTS', 'City already exists in this state');
    }

    state.cities.push({
      name,
      code: code.toUpperCase(),
      zipCodes: zipCodes || [],
      isActive: true
    });

    location.updatedBy = req.user.id;
    await location.save();

    return sendSuccessResponse(res, 200, { location }, 'City added successfully');
  } catch (error) {
    console.error('Add city error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to add city');
  }
};

export const addZipCode = async (req, res) => {
  try {
    const { zone, stateId, cityId } = req.params;
    const { code, area } = req.body;

    if (!code) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Zip code is required');
    }

    const location = await Location.findOne({ _id: zone, isActive: true, tenantId: req.user.tenantId });
    if (!location) {
      return sendErrorResponse(res, 404, 'LOCATION_NOT_FOUND', 'Location not found');
    }

    const state = location.states.id(stateId);
    if (!state || !state.isActive) {
      return sendErrorResponse(res, 404, 'STATE_NOT_FOUND', 'State not found');
    }

    const city = state.cities.id(cityId);
    if (!city || !city.isActive) {
      return sendErrorResponse(res, 404, 'CITY_NOT_FOUND', 'City not found');
    }

    const existingZip = city.zipCodes.find(z => z.code === code);
    if (existingZip) {
      return sendErrorResponse(res, 409, 'ZIP_EXISTS', 'Zip code already exists in this city');
    }

    city.zipCodes.push({
      code,
      area,
      isActive: true
    });

    location.updatedBy = req.user.id;
    await location.save();

    return sendSuccessResponse(res, 200, { location }, 'Zip code added successfully');
  } catch (error) {
    console.error('Add zip code error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to add zip code');
  }
};

export const getStatesByZone = async (req, res) => {
  try {
    const { zone } = req.params;

    const location = await Location.findOne({ _id: zone, isActive: true, tenantId: req.user.tenantId });
    if (!location) {
      return sendErrorResponse(res, 404, 'LOCATION_NOT_FOUND', 'Location not found');
    }

    const states = location.states.filter(s => s.isActive);
    return sendSuccessResponse(res, 200, { states }, 'States retrieved successfully');
  } catch (error) {
    console.error('Get states error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve states');
  }
};

export const getCitiesByState = async (req, res) => {
  try {
    const { zone, stateId } = req.params;

    const location = await Location.findOne({ _id: zone, isActive: true, tenantId: req.user.tenantId });
    if (!location) {
      return sendErrorResponse(res, 404, 'LOCATION_NOT_FOUND', 'Location not found');
    }

    const state = location.states.id(stateId);
    if (!state || !state.isActive) {
      return sendErrorResponse(res, 404, 'STATE_NOT_FOUND', 'State not found');
    }

    const cities = state.cities.filter(c => c.isActive);
    return sendSuccessResponse(res, 200, { cities }, 'Cities retrieved successfully');
  } catch (error) {
    console.error('Get cities error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve cities');
  }
};

export const getZipCodesByCity = async (req, res) => {
  try {
    const { zone, stateId, cityId } = req.params;

    const location = await Location.findOne({ _id: zone, isActive: true, tenantId: req.user.tenantId });
    if (!location) {
      return sendErrorResponse(res, 404, 'LOCATION_NOT_FOUND', 'Location not found');
    }

    const state = location.states.id(stateId);
    if (!state || !state.isActive) {
      return sendErrorResponse(res, 404, 'STATE_NOT_FOUND', 'State not found');
    }

    const city = state.cities.id(cityId);
    if (!city || !city.isActive) {
      return sendErrorResponse(res, 404, 'CITY_NOT_FOUND', 'City not found');
    }

    const zipCodes = city.zipCodes.filter(z => z.isActive);
    return sendSuccessResponse(res, 200, { zipCodes }, 'Zip codes retrieved successfully');
  } catch (error) {
    console.error('Get zip codes error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve zip codes');
  }
};

export const assignRegionalManager = async (req, res) => {
  try {
    const { zone } = req.params;
    const { managerId, managerName } = req.body;

    if (!managerId) {
      return sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Manager ID is required');
    }

    const location = await Location.findOne({ _id: zone, isActive: true, tenantId: req.user.tenantId });
    if (!location) {
      return sendErrorResponse(res, 404, 'LOCATION_NOT_FOUND', 'Location not found');
    }

    location.regionalManager = {
      refId: managerId,
      name: managerName
    };
    location.updatedBy = req.user.id;
    await location.save();

    await location.populate('regionalManager.refId', 'username employeeName email phone');

    return sendSuccessResponse(res, 200, { location }, 'Regional manager assigned successfully');
  } catch (error) {
    console.error('Assign regional manager error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to assign regional manager');
  }
};

export const updateLocation = async (req, res) => {
  try {
    const { zone } = req.params;
    const updates = req.body;

    delete updates._id;
    delete updates.createdBy;
    delete updates.zone;

    const location = await Location.findOne({ _id: zone, isActive: true, tenantId: req.user.tenantId });
    if (!location) {
      return sendErrorResponse(res, 404, 'LOCATION_NOT_FOUND', 'Location not found');
    }

    Object.assign(location, updates);
    location.updatedBy = req.user.id;
    await location.save();

    return sendSuccessResponse(res, 200, { location }, 'Location updated successfully');
  } catch (error) {
    console.error('Update location error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to update location');
  }
};

export const deactivateLocation = async (req, res) => {
  try {
    const { zone } = req.params;

    const location = await Location.findById(zone);
    if (!location) {
      return sendErrorResponse(res, 404, 'LOCATION_NOT_FOUND', 'Location not found');
    }

    location.isActive = false;
    location.updatedBy = req.user.id;
    await location.save();

    return sendSuccessResponse(res, 200, null, 'Location deactivated successfully');
  } catch (error) {
    console.error('Deactivate location error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to deactivate location');
  }
};

export const searchByZipCode = async (req, res) => {
  try {
    const { zipCode } = req.params;

    const location = await Location.findByZipCode(zipCode);
    if (!location) {
      return sendErrorResponse(res, 404, 'LOCATION_NOT_FOUND', 'Location not found for this zip code');
    }

    let result = { zone: location.zone };
    
    for (const state of location.states) {
      for (const city of state.cities) {
        const zip = city.zipCodes.find(z => z.code === zipCode && z.isActive);
        if (zip) {
          result.state = state.name;
          result.city = city.name;
          result.zipCode = zip;
          result.regionalManager = location.regionalManager;
          break;
        }
      }
      if (result.state) break;
    }

    return sendSuccessResponse(res, 200, result, 'Location found');
  } catch (error) {
    console.error('Search by zip code error:', error);
    return sendErrorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to search location');
  }
};
