import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

// RF33: cadastro de cursos mantido pelo administrador. A v4.9 reduziu a
// entidade ao mínimo — id e nome — e removeu a instituição, que virou texto
// livre na formação do candidato (task 09).
//
// Note que NÃO há coluna `ativo`. A RF33 diz "curso sem uso pode ser
// excluído", então aqui a exclusão é física mesmo. A RNF06 ("registros com
// vínculos são desativados, não apagados") continua valendo para o caso
// oposto: curso COM vínculo não é excluído nem desativado — simplesmente não
// pode sair.
@Entity("courses")
export class Course {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Único no banco, não só no service: a checagem prévia é resposta
  // amigável, a constraint é a garantia.
  @Column({ name: "name", type: "varchar", length: 120, unique: true })
  name: string;

  @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
  createdAt: Date;
}
