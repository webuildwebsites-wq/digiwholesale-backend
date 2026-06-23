import express from 'express';
import { ProtectUser } from '../../middlewares/Auth/AdminMiddleware/adminMiddleware.js';
import { updateEmployeeDetails, deactivateEmployee, getEmployeeDetails, getSupervisorsByDepartment, getAllEmployees, createEmployee, createDraftEmployee, getAllDraftEmployee, getMyDraftEmployee, getDraftEmployeeDetails, restoreEmployee, getDeletedEmployees, getEmployeesUnderSupervisor, getEmployeesUnderTeamLead, getDepartmentHierarchy, getMultipleEmployees } from '../../core/controllers/Auth/Employee/EmployeeManagement.js';
import { deactivateEmployeeDraft, updateDraftEmployee, restoreEmployeeDraft, getDeletedEmployeeDrafts } from '../../core/controllers/Auth/Employee/draft.employee.controller.js';
import { requireSubAdminOrHigher, canManageEmployee } from '../../middlewares/Auth/AdminMiddleware/roleMiddleware.js';
import { checkPageAccess, checkPermission } from '../../middlewares/Auth/AdminMiddleware/rbac.middleware.js';

const employeeManagementRouter = express.Router();

employeeManagementRouter.use(ProtectUser);

employeeManagementRouter.post('/create-employee', checkPageAccess('REGISTER_STAFF'), checkPermission('ADD_STAFF'), createEmployee);
employeeManagementRouter.post('/create-draft-employee', checkPageAccess('REGISTER_STAFF'), checkPermission('ADD_STAFF'), createDraftEmployee);

employeeManagementRouter.get('/get-all-employees', checkPageAccess('STAFF_LIST'), getAllEmployees);

employeeManagementRouter.get('/get-all-draft-employee', checkPageAccess('STAFF_LIST'), canManageEmployee, getAllDraftEmployee);
employeeManagementRouter.get('/get-my-draft-employee', checkPageAccess('STAFF_LIST'), getMyDraftEmployee);

employeeManagementRouter.get('/get-employee/:userId', checkPageAccess('STAFF_LIST'), canManageEmployee, getEmployeeDetails);
employeeManagementRouter.post('/get-multiple-employees', checkPageAccess('STAFF_LIST'), canManageEmployee, getMultipleEmployees);
employeeManagementRouter.get('/get-draft-employee/:userId', checkPageAccess('STAFF_LIST'), getDraftEmployeeDetails);

employeeManagementRouter.put('/update-employee/:userId', checkPermission('UPDATE_STAFF'), canManageEmployee, updateEmployeeDetails);
employeeManagementRouter.put('/update-draft-employee/:draftId', checkPermission('UPDATE_STAFF'), canManageEmployee, updateDraftEmployee);

employeeManagementRouter.delete('/deactivate-draft-employee/:draftId', checkPermission('DELETE_STAFF'), deactivateEmployeeDraft);
employeeManagementRouter.delete('/delete-employee/:userId', checkPermission('DELETE_STAFF'), deactivateEmployee);

employeeManagementRouter.put('/restore-employee/:userId', checkPermission('UPDATE_STAFF'), restoreEmployee);
employeeManagementRouter.put('/restore-draft-employee/:draftId', checkPermission('UPDATE_STAFF'), restoreEmployeeDraft);

employeeManagementRouter.get('/get-deleted-employees', checkPageAccess('STAFF_LIST'), getDeletedEmployees);
employeeManagementRouter.get('/get-deleted-draft-employees', checkPageAccess('STAFF_LIST'), getDeletedEmployeeDrafts);

employeeManagementRouter.get('/supervisors', requireSubAdminOrHigher, getSupervisorsByDepartment);

employeeManagementRouter.get('/supervisor/:supervisorId/employees', checkPageAccess('STAFF_LIST'), canManageEmployee, getEmployeesUnderSupervisor);
employeeManagementRouter.get('/teamlead/:teamLeadId/employees', checkPageAccess('STAFF_LIST'), canManageEmployee, getEmployeesUnderTeamLead);
employeeManagementRouter.get('/department/:departmentId/hierarchy', checkPageAccess('STAFF_LIST'), canManageEmployee, getDepartmentHierarchy);

export default employeeManagementRouter;
