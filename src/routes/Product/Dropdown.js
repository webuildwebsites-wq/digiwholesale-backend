import express from 'express';
import {
  createBrand, getAllBrands, getBrandById, updateBrand, deleteBrand,
  createCategory, getAllCategories, getCategoriesByBrand, getCategoryById, updateCategory, deleteCategory,
  createBusinessType, getAllBusinessTypes, getBusinessTypeById, updateBusinessType, deleteBusinessType,
  createGSTType, getAllGSTTypes, getGSTTypeById, updateGSTType, deleteGSTType,
  createPlant, getAllPlants, getPlantById, updatePlant, deletePlant,
  createLab, getAllLabs, getLabById, updateLab, deleteLab,
  createFittingCenter, getAllFittingCenters, getFittingCenterById, updateFittingCenter, deleteFittingCenter,
  createCreditDay, getAllCreditDays, getCreditDayById, updateCreditDay, deleteCreditDay,
  createCourierName, getAllCourierNames, getCourierNameById, updateCourierName, deleteCourierName,
  createCourierTime, getAllCourierTimes, getCourierTimeById, updateCourierTime, deleteCourierTime,
  createState, getAllStates, getStateById, updateState, deleteState,
  createCountry, getAllCountries, getCountryById, updateCountry, deleteCountry,
  createBillingCurrency, getAllBillingCurrencies, getBillingCurrencyById, updateBillingCurrency, deleteBillingCurrency,
  createSpecificLab, getAllSpecificLabs, getSpecificLabById, updateSpecificLab, deleteSpecificLab
} from '../../core/controllers/Product/DropdownController.js';
import { ProtectUser } from '../../middlewares/Auth/AdminMiddleware/adminMiddleware.js';

const dropdownRouter = express.Router();

dropdownRouter.use(ProtectUser);

// State Routes
dropdownRouter.post('/states', createState);
dropdownRouter.get('/states', getAllStates);
dropdownRouter.get('/states/:id', getStateById);
dropdownRouter.put('/states/:id', updateState);
dropdownRouter.delete('/states/:id', deleteState);

// Country Routes
dropdownRouter.post('/countries', createCountry);
dropdownRouter.get('/countries', getAllCountries);
dropdownRouter.get('/countries/:id', getCountryById);
dropdownRouter.put('/countries/:id', updateCountry);
dropdownRouter.delete('/countries/:id', deleteCountry);

// Billing Currency Routes
dropdownRouter.post('/billing-currencies', createBillingCurrency);
dropdownRouter.get('/billing-currencies', getAllBillingCurrencies);
dropdownRouter.get('/billing-currencies/:id', getBillingCurrencyById);
dropdownRouter.put('/billing-currencies/:id', updateBillingCurrency);
dropdownRouter.delete('/billing-currencies/:id', deleteBillingCurrency);

// Business Type Routes
dropdownRouter.post('/business-types', createBusinessType);
dropdownRouter.get('/business-types', getAllBusinessTypes);
dropdownRouter.get('/business-types/:id', getBusinessTypeById);
dropdownRouter.put('/business-types/:id', updateBusinessType);
dropdownRouter.delete('/business-types/:id', deleteBusinessType);

// GST Type Routes
dropdownRouter.post('/gst-types', createGSTType);
dropdownRouter.get('/gst-types', getAllGSTTypes);
dropdownRouter.get('/gst-types/:id', getGSTTypeById);
dropdownRouter.put('/gst-types/:id', updateGSTType);
dropdownRouter.delete('/gst-types/:id', deleteGSTType);

// Credit Day Routes
dropdownRouter.post('/credit-days', createCreditDay);
dropdownRouter.get('/credit-days', getAllCreditDays);
dropdownRouter.get('/credit-days/:id', getCreditDayById);
dropdownRouter.put('/credit-days/:id', updateCreditDay);
dropdownRouter.delete('/credit-days/:id', deleteCreditDay);

// Courier Time Routes
dropdownRouter.post('/courier-times', createCourierTime);
dropdownRouter.get('/courier-times', getAllCourierTimes);
dropdownRouter.get('/courier-times/:id', getCourierTimeById);
dropdownRouter.put('/courier-times/:id', updateCourierTime);
dropdownRouter.delete('/courier-times/:id', deleteCourierTime);


// Plant Routes
dropdownRouter.post('/plants', createPlant);
dropdownRouter.get('/plants', getAllPlants);
dropdownRouter.get('/plants/:id', getPlantById);
dropdownRouter.put('/plants/:id', updatePlant);
dropdownRouter.delete('/plants/:id', deletePlant);

// Lab Routes
dropdownRouter.post('/labs', createLab);
dropdownRouter.get('/labs', getAllLabs);
dropdownRouter.get('/labs/:id', getLabById);
dropdownRouter.put('/labs/:id', updateLab);
dropdownRouter.delete('/labs/:id', deleteLab);

// Fitting Center Routes
dropdownRouter.post('/fitting-centers', createFittingCenter);
dropdownRouter.get('/fitting-centers', getAllFittingCenters);
dropdownRouter.get('/fitting-centers/:id', getFittingCenterById);
dropdownRouter.put('/fitting-centers/:id', updateFittingCenter);
dropdownRouter.delete('/fitting-centers/:id', deleteFittingCenter);

// Courier Name Routes
dropdownRouter.post('/courier-names', createCourierName);
dropdownRouter.get('/courier-names', getAllCourierNames);
dropdownRouter.get('/courier-names/:id', getCourierNameById);
dropdownRouter.put('/courier-names/:id', updateCourierName);
dropdownRouter.delete('/courier-names/:id', deleteCourierName);

// Brand Routes
dropdownRouter.post('/brands', createBrand);
dropdownRouter.get('/brands', getAllBrands);
dropdownRouter.get('/brands/:id', getBrandById);
dropdownRouter.put('/brands/:id', updateBrand);
dropdownRouter.delete('/brands/:id', deleteBrand);

// Category Routes
dropdownRouter.post('/categories', createCategory);
dropdownRouter.get('/categories', getAllCategories);
dropdownRouter.get('/categories/brand/:brandId', getCategoriesByBrand);
dropdownRouter.get('/categories/:id', getCategoryById);
dropdownRouter.put('/categories/:id', updateCategory);
dropdownRouter.delete('/categories/:id', deleteCategory);

// Specific Lab Routes
dropdownRouter.post('/specific-labs', createSpecificLab);
dropdownRouter.get('/specific-labs', getAllSpecificLabs);
dropdownRouter.get('/specific-labs/:id', getSpecificLabById);
dropdownRouter.put('/specific-labs/:id', updateSpecificLab);
dropdownRouter.delete('/specific-labs/:id', deleteSpecificLab);

export default dropdownRouter;
