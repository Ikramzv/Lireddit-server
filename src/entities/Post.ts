import { Field, Int, ObjectType } from "type-graphql";
import { BaseEntity, Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Updoot } from "./Updoot";
import { User } from "./User";

@ObjectType()
@Entity()
export class Post extends BaseEntity {
    @Field(() => String)
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Field(() => String!)
    @Column({ type: 'string' })
    creatorId!: string

    @Field(() => User)
    @ManyToOne(() => User , (user) => user.posts)
    creator: User

    @Field(() => String!)
    @Column({ type: 'text' })
    text!: string

    @Field(() => Int)
    @Column({ type: 'int', default: 0 })
    points!: number

    @Field(() => Int , { nullable: true })
    voteStatus: number | null
    
    @Field(() => String!)
    @Column({ type: 'text' })
    title!: string;

    @Field(() => Updoot)
    @OneToMany(() => Updoot , (updoot) => updoot.post)
    updoot: Updoot[]

    @Field(() => String)
    @CreateDateColumn({type: 'timestamp'})
    createdAt: Date
    
    @Field(() => String)
    @UpdateDateColumn({type: 'timestamp' })
    updatedAt: Date
}