import DataLoader from "dataloader";
import { In } from "typeorm";
import { Updoot } from "../entities/Updoot";

export const createUpdootLoader = () => new DataLoader<{postId: string , userId: string} , Updoot | null>(async (keys) => {
    const updoots = await Updoot.findBy({ 
        userId: In(keys.map(key => key.userId)) , 
        postId: In(keys.map(key => key.postId)) 
    })
    const updootIdsToUpdoot: Record<string , Updoot> = {}
    updoots.forEach(updoot => {
        updootIdsToUpdoot[`${updoot.userId}|${updoot.postId}`] = updoot
    })

    console.log(keys.map(key => updootIdsToUpdoot[`${key.userId}|${key.postId}`]))

    return keys.map(key => updootIdsToUpdoot[`${key.userId}|${key.postId}`])
})
    
