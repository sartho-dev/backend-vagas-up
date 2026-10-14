import { StudentService } from "../service/StudentService";
import { Response, Request } from "express";
import { createStudentSchema } from "../validators/CreateStudentValidator";
import { ApiResponse } from "../../../shared/types/ApiResponse";
import { asyncHandler } from "../../../shared/middleware/asyncHandler";
import { updateStudentSchema } from "../validators/UpdateStudentValidator";
import { getAuth } from "../../auth/types/AccountRole";
import {
  StudentCreatedResult,
  StudentProfileResult,
} from "../types/typesStudents";

export class StudentController {
  constructor(private studentService: StudentService) {}

  createController = asyncHandler(async (req: Request, res: Response) => {
    const data = createStudentSchema.parse(req.body);
    const student = await this.studentService.createService(data);

    const response: ApiResponse<StudentCreatedResult> = {
      status: "success",
      data: student,
    };

    res.status(201).json(response);
  });

  updateController = asyncHandler(async (req: Request, res: Response) => {
    const data = updateStudentSchema.parse(req.body);
    const { accountId: studentId } = getAuth(res);

    const profile = await this.studentService.updateService(studentId, data);

    const response: ApiResponse<StudentProfileResult> = {
      status: "success",
      data: profile,
    };

    res.status(200).json(response);
  });
}
