const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const app = express();
require('dotenv').config({});

const tableName = 'product_db';
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {fileSize: 200000}
})


process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE=1

AWS.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_USER_ACCESS_KEY,
    secretAccessKey: process.env.AWS_USER_SECRET_KEY
})

const S3 = new AWS.S3()
const DynamoDB = new AWS.DynamoDB.DocumentClient();

app.set('view engine', 'ejs');
app.use(express.urlencoded({
    extended: true
}));

app.get('/', async(req, res, next) => {
    const params = {
        TableName: tableName
    }
    const data = await DynamoDB.scan(params).promise();

    return res.render('index.ejs', {data: data.Items});
})

app.post('/save', upload.single('image'), async(req, res, next) => {
    const {id, name, quantity} = req.body;
     if(req.file){
        const imageName = `${req.file.originalname}-${Date.now()}`
        const s3Params = {
            Bucket: process.env.AWS_S3_BUCKET,
            ContentType: req.file.mimetype,
            Body: req.file.buffer,
            Key: imageName
        }
        S3.upload(s3Params, async (error, data) => {
            if(error){
                console.log("UPLOAD S3 FAILED");
                return res.send('Internal server error')
            }
            
            const imageUrl = data.Location;
            console.log("s3 data: ", imageUrl);
            const dynamoParams = {
                TableName: tableName,
                Item: {
                    id,
                    name,
                    quantity,
                    image: imageUrl
                }
            }
    
            await DynamoDB.put(dynamoParams).promise();
            return res.redirect('/');
        })
    }
    else{
        return res.redirect('/');
    }
    
})

app.post('/delete', async(req, res, next) => {
    const {id} = req.body;
    const listId = [...id];

    const promise = listId.map(async (el) =>{
        const dynamoDBParams = {
            TableName: tableName,
            Key: {
                id: el
            }
        }
        return await DynamoDB.delete(dynamoDBParams).promise()
    })             
    await Promise.all(promise);

    return res.redirect('/');
    
})

app.listen(3000, () => {
    console.log("Server is listening on PORT 3000");
})