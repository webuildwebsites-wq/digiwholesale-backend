import employeeSchema from "../../../../models/Auth/Employee.js";
import { sendErrorResponse, sendSuccessResponse } from "../../../../Utils/response/responseHandler.js";

export const getAllSalesPersons = async (req, res) => {
  try {
    const { isActive, employeeType, zone, page = 1, limit = 100 } = req.query;
    
    const filter = {
      'Department.name': 'SALES',
      tenantId: req.user.tenantId,
    };

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (employeeType) {
      filter.EmployeeType = employeeType.toUpperCase();
    }

    if (zone) {
      filter['zone.refId'] = zone.toUpperCase();
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [salesPersons, total] = await Promise.all([
      employeeSchema
        .find(filter)
        .select('username employeeName email phone Department EmployeeType zone lab isActive subRoles')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      employeeSchema.countDocuments(filter)
    ]);

    const pagination = {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalRecords: total,
      limit: parseInt(limit)
    };

    return sendSuccessResponse(res, 200, { salesPersons, pagination }, "Sales persons retrieved successfully");
  } catch (error) {
    console.error("Get All Sales Persons Error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to retrieve sales persons");
  }
};

export const getSalesPersonById = async (req, res) => {
  try {
    const { id } = req.params;

    const salesPerson = await employeeSchema.findOne({ 
        _id: id, 
        'Department.name': 'SALES',
        EmployeeType: { $in: ['EMPLOYEE', 'SUPERVISOR'] },
        tenantId: req.user.tenantId,
      }).select('username employeeName email phone Department EmployeeType zone lab isActive profile');

    if (!salesPerson) {
      return sendErrorResponse(res, 404, "NOT_FOUND", "Sales person not found");
    }

    return sendSuccessResponse(res, 200, salesPerson, "Sales person retrieved successfully");
  } catch (error) {
    console.error("Get Sales Person Error:", error);
    return sendErrorResponse(res, 500, "INTERNAL_ERROR", "Failed to retrieve sales person");
  }
};
