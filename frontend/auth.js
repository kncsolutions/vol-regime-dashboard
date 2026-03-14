const ALLOWED_USERS = [
    "pallavagt@gmail.com",
    "kncsolns@gmail.com"
]
const firebaseConfig = {

  apiKey: "AIzaSyBJVNTH5MJk1OR8t_69wcc1mqn7zXmgt0g",

  authDomain: "dhelm-vol-regime-dashboard.firebaseapp.com",

  projectId: "dhelm-vol-regime-dashboard",

  storageBucket: "dhelm-vol-regime-dashboard.firebasestorage.app",

  messagingSenderId: "341367021880",

  appId: "1:341367021880:web:64e26bdf41e5baf3ce21cd"

};



firebase.initializeApp(firebaseConfig)

const auth = firebase.auth()

window.FIREBASE_TOKEN = null


// LOGIN
async function login() {

    const provider = new firebase.auth.GoogleAuthProvider()

    await auth.signInWithPopup(provider)

}


// LOGOUT
function logout() {

    auth.signOut()
    window.location.href = "login.html"

}


auth.onAuthStateChanged(async (user)=>{

    if(user){

        const token = await user.getIdToken()

        window.FIREBASE_TOKEN = token

        // redirect from login page to dashboard
        if(window.location.pathname.includes("login")){
            window.location.href = "index.html"
            return
        }

        let dash = document.getElementById("dashboard")
        if(dash) dash.style.display = "block"

        let loading = document.getElementById("loading")
        if(loading) loading.style.display = "none"

        if(typeof initDashboard === "function"){
            initDashboard()
        }

    }

    else{

        // if not logged in → go to login page
        if(!window.location.pathname.includes("login")){
            window.location.href = "login.html"
        }

    }

})