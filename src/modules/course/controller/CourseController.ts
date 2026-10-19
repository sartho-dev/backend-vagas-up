import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware/asyncHandler";
import { ApiResponse } from "../../../shared/types/ApiResponse";
import { CourseService } from "../service/CourseService";
import {
  courseIdParamSchema,
  createCourseSchema,
  updateCourseSchema,
} from "../validators/CourseValidator";
import { CourseResult } from "../types/CourseTypes";

export class CourseController {
  constructor(private courseService: CourseService) {}

  // Público: estudante precisa da lista para declarar formação (RF11) e o
  // responsável, para indicar o curso da vaga (RF24).
  listController = asyncHandler(async (_req: Request, res: Response) => {
    const courses = await this.courseService.listService();

    const response: ApiResponse<CourseResult[]> = {
      status: "success",
      data: courses,
    };

    res.status(200).json(response);
  });

  // RF33 — daqui para baixo, só administrador.
  createController = asyncHandler(async (req: Request, res: Response) => {
    const { name } = createCourseSchema.parse(req.body);

    const course = await this.courseService.createService(name);

    const response: ApiResponse<CourseResult> = {
      status: "success",
      data: course,
    };

    res.status(201).json(response);
  });

  renameController = asyncHandler(async (req: Request, res: Response) => {
    const { id } = courseIdParamSchema.parse(req.params);
    const { name } = updateCourseSchema.parse(req.body);

    const course = await this.courseService.renameService(id, name);

    const response: ApiResponse<CourseResult> = {
      status: "success",
      data: course,
    };

    res.status(200).json(response);
  });

  deleteController = asyncHandler(async (req: Request, res: Response) => {
    const { id } = courseIdParamSchema.parse(req.params);

    await this.courseService.deleteService(id);

    res.status(204).send();
  });
}
