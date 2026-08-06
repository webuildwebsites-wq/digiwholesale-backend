import express from 'express';
import { customerForgotPassword, customerLogin, customerResetPassword, customerBasicRegistration, updateCustomerProfile, resetCustomerCredit, sendCustomerForCorrection, resubmitCorrectedCustomer, updateCustomerShipToDetails, updateCustomerContact } from '../../core/controllers/Auth/Customers/CustomerAuth.js';
import { financeApproveCustomer, salesHeadApproveCustomer, acceptTermsAndConditions, getPendingCustomersByStage, financeResubmitToSalesHead } from '../../core/controllers/Auth/Customers/CustomerApprovalWorkflow.js';
import { getAllCustomers, getCustomerById, getCustomerProfile, getDraftCustomers, getCorrectionRequiredCustomers, getPendingTermsCustomers } from '../../core/controllers/Auth/Customers/customer.get.controller.js';
import { requireSalesFinanceOrSuperAdmin, attachDepartmentInfo } from '../../middlewares/Auth/AdminMiddleware/departmentMiddleware.js';
import { protectCustomer } from '../../middlewares/Auth/CustomerMiddleware/customerMiddleware.js';
import { verifyCustomerEmail } from '../../core/controllers/Auth/Customers/VarifyAccount.js';
import { ProtectUser } from '../../middlewares/Auth/AdminMiddleware/adminMiddleware.js';
import { logout, refreshToken } from '../../Utils/Auth/tokenUtils.js';
import { customerDraftRegistration, deactivateCustomer, deactivateDraftCustomer, getAllDraftCustomers, getMyDraftCustomers, updateDraftCustomer, restoreCustomer, restoreDraftCustomer, getDeletedCustomers, getDeletedDraftCustomers } from '../../core/controllers/Auth/Customers/darft.customers.controller.js';
import { checkPageAccess, checkPermission } from '../../middlewares/Auth/AdminMiddleware/rbac.middleware.js';

const customerRouter = express.Router();

customerRouter.post('/login', customerLogin);
customerRouter.post('/register', ProtectUser, attachDepartmentInfo, requireSalesFinanceOrSuperAdmin, checkPageAccess('REGISTER_CUSTOMER'), checkPermission('ADD_CUSTOMER'), customerBasicRegistration);
customerRouter.post('/draft-register', ProtectUser, attachDepartmentInfo, checkPageAccess('REGISTER_CUSTOMER'), checkPermission('ADD_CUSTOMER'), customerDraftRegistration);

customerRouter.put('/:customerId/finance-approve', ProtectUser, attachDepartmentInfo, financeApproveCustomer);
customerRouter.put('/:customerId/sales-head-approve', ProtectUser, attachDepartmentInfo, salesHeadApproveCustomer);
customerRouter.put('/:customerId/finance-resubmit', ProtectUser, attachDepartmentInfo, financeResubmitToSalesHead);
customerRouter.put('/accept-terms-conditions', protectCustomer, acceptTermsAndConditions);

customerRouter.get('/pending-stage', ProtectUser, attachDepartmentInfo, checkPageAccess('APPROVALS'), getPendingCustomersByStage);

customerRouter.put('/:customerId/send-for-correction', ProtectUser, attachDepartmentInfo, checkPermission('UPDATE_CUSTOMER'), sendCustomerForCorrection);
customerRouter.put('/:customerId/resubmit-correction', ProtectUser, attachDepartmentInfo, checkPermission('UPDATE_CUSTOMER'), resubmitCorrectedCustomer);

customerRouter.patch('/update-contact/:customerId', ProtectUser, checkPermission('UPDATE_CUSTOMER'), updateCustomerContact);
customerRouter.put('/update-profile/:customerId', ProtectUser, checkPermission('UPDATE_CUSTOMER'), updateCustomerProfile);
customerRouter.put('/update-ship-to-details/:customerId', ProtectUser, attachDepartmentInfo, checkPermission('UPDATE_CUSTOMER'), updateCustomerShipToDetails);

customerRouter.put('/reset-credit/:customerId', ProtectUser, attachDepartmentInfo, resetCustomerCredit);

customerRouter.post('/forgot-password', customerForgotPassword);
customerRouter.put('/reset-password/confirm', customerResetPassword);
customerRouter.post('/verify-email', verifyCustomerEmail);

customerRouter.post('/refresh', refreshToken);
customerRouter.post('/logout', protectCustomer, logout);

customerRouter.get('/customer/correction-required', ProtectUser, attachDepartmentInfo, checkPageAccess('CORRECTIONS'), getCorrectionRequiredCustomers);
customerRouter.get('/customer/pending-terms', ProtectUser, attachDepartmentInfo, checkPageAccess('APPROVALS'), getPendingTermsCustomers);
customerRouter.get('/get-all-customers', ProtectUser, checkPageAccess('CUSTOMER_LIST'), getAllCustomers);
customerRouter.get('/customers-profile', protectCustomer, getCustomerProfile);
customerRouter.get('/get-customer/:customerId', ProtectUser, getCustomerById);
customerRouter.get('/get-draft-customer/:customerId',ProtectUser, getDraftCustomers);

customerRouter.get('/get-all-draft-customers', ProtectUser, attachDepartmentInfo, requireSalesFinanceOrSuperAdmin, checkPageAccess('CUSTOMER_LIST'), getAllDraftCustomers);
customerRouter.get('/get-my-draft-customers', ProtectUser, attachDepartmentInfo, requireSalesFinanceOrSuperAdmin, checkPageAccess('CUSTOMER_LIST'), getMyDraftCustomers);

customerRouter.put('/update-draft-customer/:draftId', ProtectUser, attachDepartmentInfo, requireSalesFinanceOrSuperAdmin, checkPermission('UPDATE_CUSTOMER'), updateDraftCustomer);

customerRouter.delete('/deactivate-customer/:customerId', ProtectUser, attachDepartmentInfo, requireSalesFinanceOrSuperAdmin, checkPermission('DELETE_CUSTOMER'), deactivateCustomer);
customerRouter.delete('/deactivate-draft-customer/:draftId', ProtectUser, attachDepartmentInfo, checkPermission('DELETE_CUSTOMER'), deactivateDraftCustomer);

customerRouter.put('/restore-customer/:customerId', ProtectUser, attachDepartmentInfo, requireSalesFinanceOrSuperAdmin, checkPermission('UPDATE_CUSTOMER'), restoreCustomer);
customerRouter.put('/restore-draft-customer/:draftId', ProtectUser, attachDepartmentInfo, checkPermission('UPDATE_CUSTOMER'), restoreDraftCustomer);

customerRouter.get('/get-deleted-customers', ProtectUser, attachDepartmentInfo, requireSalesFinanceOrSuperAdmin, checkPageAccess('CUSTOMER_LIST'), getDeletedCustomers);
customerRouter.get('/get-deleted-draft-customers', ProtectUser, attachDepartmentInfo, checkPageAccess('CUSTOMER_LIST'), getDeletedDraftCustomers);

export default customerRouter;
