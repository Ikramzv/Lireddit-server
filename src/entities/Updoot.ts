import { Field, Int, ObjectType } from "type-graphql";
import { BaseEntity, Column, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import { Post } from "./Post";
import { User } from "./User";

@ObjectType()
@Entity()
export class Updoot extends BaseEntity {
    @Field(() => Int)
    @Column({ type: 'int'})
    value: number

    @PrimaryColumn({ type: 'string' })
    userId: string

    @ManyToOne(() => User , (user) => user.updoot)
    user: User

    @PrimaryColumn({ type: 'string' })
    postId: string

    @ManyToOne(() => Post , post => post.updoot , { onDelete: 'CASCADE'  })
    post: Post
}