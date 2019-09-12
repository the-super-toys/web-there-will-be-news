// Config constants
const evictEachSeconds = 60 * 60;
const newsFrontPageCount = 250;
const newsToCache = 5000;

//relative dates
const moment = require('moment');

// States
let cachedNews = [];
let lastEvictDate = new Date();

// DB setup
const mongoose = require('mongoose');

const mongodbPath = process.env.MONGO_URL || "mongodb://localhost:27017/therewillbenews";
mongoose.connect(mongodbPath, {useNewUrlParser: true});
const News = mongoose.model('News', new mongoose.Schema({
    title: String,
    subtitle: String,
    body: String,
    url_image: String,
    category: String,
    date: Date
}));

// express setup
const express = require('express');
const app = express();

// mustache setup
const mustacheExpress = require('mustache-express');
app.use('/css', express.static(__dirname + '/views/css'));
app.use('/css', express.static(__dirname + '/node_modules/bootstrap/dist/css'));
app.engine('html', mustacheExpress());
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

function evictCacheIfNeeded() {
    const secondsElapsed = Math.round((new Date() - lastEvictDate) / 1000);
    if (secondsElapsed < evictEachSeconds && cachedNews.length !== 0) return;

    News.find({})
        .sort({date: 'desc'})
        .limit(newsToCache)
        .exec(function (err, news) {
            if (err) {
                console.error(news);
                return
            }
            cachedNews = news
        });
}

function asEntity(news) {
    return {
        'id': news._id,
        'title': news.title,
        'subtitle': news.subtitle,
        'body': news.body.replace(/(?:\r\n|\r|\n)/g, '<br/>').replace('Also on HuffPost:', ''),
        'category': news.category,
        'date': moment(news.date).fromNow()
    };
}

evictCacheIfNeeded();

// routing setup
app.get('/', function (req, res) {
    evictCacheIfNeeded();
    let newsToShow = cachedNews.slice(0, newsFrontPageCount).map(news => asEntity(news));
    res.render('frontpage', {'news': newsToShow});
});

app.get('/categories/:category', function (req, res) {
    const filtered = cachedNews.filter(function (news) {
        return news.category === req.params.category;
    });

    res.render('frontpage', {'news': filtered.map(news => asEntity(news))});
});

app.get('/:id', function (req, res) {
    evictCacheIfNeeded();

    News.findById(req.params.id, function (err, news) {
        if (err) {
            console.error(err);
            res.send('Wrong news');
            return
        }

        news = asEntity(news);
        const urlToShare = req.protocol + '://' + req.get('host') + req.originalUrl;
        news.urlTwitter = `https://twitter.com/share?url=${urlToShare}&text=${news.title}`;
        news.urlFacebook = `https://www.facebook.com/sharer/sharer.php?u=${urlToShare}`, "pop", "width=600, height=400, scrollbars=no";

        res.render('detail', news);
    });
});

const port = process.env.PORT || 3000;
app.listen(port, function () {
    console.log(`Running on port ${port}!`);
});