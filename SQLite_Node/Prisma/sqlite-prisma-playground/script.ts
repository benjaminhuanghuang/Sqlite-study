import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from './generated/prisma/client'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// A `main` function so that you can use async/await
async function main() {
  // ... you will write your Prisma Client queries here
  // const result = await prisma.user.update({
  //   where:{
  //     email:'bbb@gmail.com'
  //   },
  //   data:{
  //     name:'bbb'
  //   }
  // });
  const result = await prisma.post.update({
    where:{
      id:1
    },
    data:{
      author:{
        connect:{email:"bbb@gmail.com"}
      }
    }
  })
  console.log(result);
}

main()
  .catch(e => {
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
