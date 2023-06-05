const User = require("../models/User");
const OTP = require("../models/OTP");
const otpGenerator = require("otp-generator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

//send otp
exports.sendOTP = async(req,res)=>{
    try{
        //fetch email from reqest body
        const {email} = req.body;

        //check if user already exist
        const checkUserPresent = await User.findOne({email});

        //if user already exist then return a response
        if(checkUserPresent){
            return res.status(401).json({
                success:false,
                message:"User already registered!",
            })
        }
        //else generate otp
        var otp = otpGenerator.generate(6,{
            upperCaseAlphabets:false,
            lowerCaseAlphabets:false,
            specialChars:false,
        });
        console.log("otp generated:",otp);

        //check if otp is unique or not ** bruteforce approach **
       let result =  await OTP.findOne({otp:otp});

       while(result){
        otp = otpGenerator.generate(6,{
            upperCaseAlphabets:false,
            lowerCaseAlphabets:false,
            specialChars:false,
        });
        result = await OTP.findOne({otp:otp});
       }

       const otpPayload = {email,otp};
       //create an entry in DB for otp
       const otpBody = await OTP.create(otpPayload);
       console.log(otpBody);

       //return response successful
       res.status(200).json({
        success:true,
        message:"otp sent successfully",
        otp,
       })
    }
    catch(error){
        console.log(error);
        return res.status(500).json({
            success:false,
            message:error.message,
        })
    }
};

//signup
exports.signUp = async(req,res)=>{
    try{
        //data fetch from request body
    const{
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
        accountType,
        contactNumber,
        otp
    }=req.body;

    //validate data
    if(!firstName || !lastName || !email || !password || !confirmPassword || ! otp){
        return res.status(403).json({
            success:false,
            message:"All fields are required",
        });
    }

    //match both passwords
    if(password !== confirmPassword){
        return res.status(400).json({
            success:false,
            message:"Your Passwords does not matched, please try again",
        });
    }

    //check user already exists
    const existingUser = await User.findOne({email});
    if(existingUser){
        return res.status(400).json({
            success:false,
            message:"User already registered",
        });
    }

    //find most resent otp stored for user
    const recentOtp = await OTP.find({email}).sort({createdAt:-1}).limit(1);
    console.log(recentOtp);

    //validate otp
    if(recentOtp.length === 0){
        //otp not found
        return res.status(400).json({
            success:false,
            message:"OTP not found"
        })
    }else if(otp !== recentOtp){
        return res.status(400).json({
            success:false,
            message:"Invalid OTP",
        });
    }
    //password hashing
    const hashedPassword  = await bcrypt.hash(password,10);

    //entry create in DB
    const profileDetails  =await Profile.create({
        gender:null,
        dateOfBirth:null,
        about:null,
        contactNumber:null,
    });
    const user = await User.create({
        firstName,
        lastName,
        email,
        contactNumber,
        password:hashedPassword,
        accountType,
        additionalDetails:profileDetails._id,
        image:`https://api.dicebar.com/5.x/initials/svg?seed=${firstName} ${lastName}`
    });
    //return res
    return res.status(200).json({
        success:true,
        message:"User is registered successfully"
    })
    }
    catch(error){
        return res.status(500).json({
            success:false,
            message:"User cannot be registered, please try again"
        })
    }
}

//Login
exports.login = async (req, res) => {
    try {
        //get data from req body
        const {email, password} = req.body;
        // validation data
        if(!email || !password) {
            return res.status(403). json({
                success:false,
                message:'All fields are required, please try again',
            });
        }
        //user check exist or not
        const user = await User.findOne({email}).populate("additionalDetails");
        if(!user) {
            return res.status(401).json({
                success:false,
                message:"User is not registrered, please signup first",
            });
        }
        //generate JWT, after password matching
        if(await bcrypt.compare(password, user.password)) {
            const payload = {
                email: user.email,
                id: user._id,
                accountType:user.accountType,
            }
            const token = jwt.sign(payload, process.env.JWT_SECRET, {
                expiresIn:"2h",
            });
            user.token = token;
            user.password= undefined;

            //create cookie and send response
            const options = {
                expires: new Date(Date.now() + 3*24*60*60*1000),
                httpOnly:true,
            }
            res.cookie("token", token, options).status(200).json({
                success:true,
                token,
                user,
                message:'Logged in successfully',
            })

        }
        else {
            return res.status(401).json({
                success:false,
                message:'Password is incorrect',
            });
        }
        
    }
    catch(error) {
        console.log(error);
        return res.status(500).json({
            success:false,
            message:'Login Failure, please try again',
        });
    }
};