import { Entity , Column , CreateDateColumn, UpdateDateColumn, BaseEntity, PrimaryGeneratedColumn, OneToMany, JoinColumn } from "typeorm";
import { Field, ObjectType } from "type-graphql";
import { Post } from "./Post";
import { Updoot } from "./Updoot";

@ObjectType()
@Entity()
export class User extends BaseEntity {
    @Field(() => String )
    @PrimaryGeneratedColumn('uuid')
    id : string
    
    @Field(() => String)
    @Column({ type: 'text' , unique: true })
    username!: string
    
    @Field(() => String)
    @Column({type: 'text' , unique: true})
    email!: string 
    
    @Column({ type: 'text' })
    password: string
    
    @OneToMany(() => Post , (post) => post.creator)
    posts: Post[]

    @Field(() => String)
    @CreateDateColumn({ type: 'timestamp' })
    createdAt: Date

    @Field(() => Updoot)
    @OneToMany(() => Updoot , (updoot) => updoot.user)
    updoot: Updoot[]
    
    @Field(() => String)
    @UpdateDateColumn({ type: 'timestamp' })
    updatedAt:  Date
}