import { StudentService } from "../service/StudentService";
import { Response, Request } from "express";
import { createStudentSchema } from "../validators/CreateStudentValidator";
import { ApiResponse } from "../../../shared/types/ApiResponse";
import { asyncHandler } from "../../../shared/middleware/asyncHandler";
import {
  changePasswordSchema,
  updateStudentSchema,
} from "../validators/UpdateStudentValidator";
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

  updateOwnProfileController = asyncHandler(async (req: Request, res: Response) => {
    const data = updateStudentSchema.parse(req.body);
    const { accountId: studentId } = getAuth(res);

    const profile = await this.studentService.updateService(studentId, data);

    const response: ApiResponse<StudentProfileResult> = {
      status: "success",
      data: profile,
    };

    res.status(200).json(response);
  });

  // RF03 / Anexo A: perfil próprio, com CPF completo.
  getOwnProfileController = asyncHandler(
    async (_req: Request, res: Response) => {
      const { accountId: studentId } = getAuth(res);

      const profile = await this.studentService.getOwnProfileService(studentId);

      const response: ApiResponse<StudentProfileResult> = {
        status: "success",
        data: profile,
      };

      res.status(200).json(response);
    },
  );

  // RF03 / RN-A5. Responde 204: não há o que devolver, e qualquer corpo aqui
  // seria dado de conta logo após uma troca de credencial.
  changePasswordController = asyncHandler(
    async (req: Request, res: Response) => {
      const data = changePasswordSchema.parse(req.body);
      const { accountId: studentId } = getAuth(res);

      await this.studentService.changePasswordService(studentId, data);

      res.status(204).send();
    },
  );
}
