import { Student } from "../schema/Student.schema";
import { StudentProfileResult } from "../types/typesStudents";

const byNewest = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);

export function toProfileResult(student: Student): StudentProfileResult {
  return {
    id: student.id,
    cpf: student.cpf,
    name: student.name,
    email: student.email,
    birthDate: student.birthDate,
    city: student.city,
    educationLevel: student.educationLevel,
    visibility: student.visibility,
    phones: student.phones.map((phone) => ({
      number: phone.number,
      isWhatsapp: phone.isWhatsapp,
    })),
    bio: student.bio,
    photoUrl: student.photoUrl,
    resumeUrl: student.resumeUrl,
    linkedinUrl: student.linkedinUrl,
    portfolioUrl: student.portfolioUrl,
    languages: student.languages
      .map((language) => ({ name: language.name, level: language.level }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    experiences: student.experiences
      .map((experience) => ({
        company: experience.company,
        role: experience.role,
        startDate: experience.startDate,
        endDate: experience.endDate,
        description: experience.description,
      }))
      .sort((a, b) => byNewest(a.startDate, b.startDate)),
    skills: student.skills
      .map((skill) => skill.name)
      .sort((a, b) => a.localeCompare(b)),
    certifications: student.certifications
      .map((certification) => ({
        name: certification.name,
        issuer: certification.issuer,
        issuedAt: certification.issuedAt,
        expiresAt: certification.expiresAt,
        credentialUrl: certification.credentialUrl,
      }))
      .sort((a, b) => byNewest(a.issuedAt, b.issuedAt)),
  };
}
