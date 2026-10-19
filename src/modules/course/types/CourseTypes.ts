export type CourseResult = {
  id: string;
  name: string;
};

// O repositório informa O QUE aconteceu; o service escolhe o status HTTP.
export type DeleteCourseOutcome = "deleted" | "not_found" | "has_links";
