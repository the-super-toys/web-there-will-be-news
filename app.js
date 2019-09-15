// Config constants
const evictEachSeconds = 60 * 60;
const newsFrontPageCount = 250;
const newsToCache = 5000;
const newsToShowForSearch = 100;

//relative dates
const moment = require('moment');

// States
let cachedNews = [];
let lastEvictDate = new Date();

// DB setup
const mongoose = require('mongoose');

const mongodbPath = process.env.MONGO_URL || "mongodb://localhost:27017/therewillbenews";
mongoose.connect(mongodbPath, {useNewUrlParser: true});

const schema = new mongoose.Schema({
    title: String,
    subtitle: String,
    body: String,
    url_image: String,
    category: String,
    positiveReviews: Number,
    negativeReviews: Number,
    date: Date
});
schema.index({title: 'text', 'subtitle': 'text', 'body': 'text'});
const News = mongoose.model('News', schema);

// express setup
const express = require('express');
const app = express();

// cookies
let cookieParser = require('cookie-parser');
app.use(cookieParser());

// mustache setup
const mustacheExpress = require('mustache-express');
app.use('/js', express.static(__dirname + '/views/js'));
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

            news.forEach(function (news) {
                news.positiveReviews = news.positiveReviews ? news.positiveReviews : 0;
                news.negativeReviews = news.negativeReviews ? news.negativeReviews : 0;
            });

            cachedNews = news.sort((a, b) => b.positiveReviews - a.positiveReviews);
        });
}

function asEntity(news) {
    return {
        'id': news._id,
        'title': news.title,
        'subtitle': news.subtitle,
        'body': news.body.replace(/(?:\r\n|\r|\n)/g, '<br/>')
            .replace('Huffington Post', 'There will be news')
            .replace('HuffPost:', 'There will be news:')
            .replace('HuffPost', 'There will be news'),
        'category': news.category,
        'positiveReviews': news.positiveReviews ? news.positiveReviews : 0,
        'negativeReviews': news.negativeReviews ? news.negativeReviews : 0,
        'hasLikes': news.positiveReviews > 0,
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

app.get('/search', function (req, res) {
    News.find({$text: {$search: req.query.query}})
        .limit(newsToShowForSearch)
        .exec(function (err, filtered) {
            if (filtered.length === 0) {
                res.render('no_results');
            } else {
                res.render('frontpage', {'news': filtered.map(news => asEntity(news))});
            }
        });
});

app.get('/:id', function (req, res) {
    evictCacheIfNeeded();

    let newsId = req.params.id;
    News.findById(newsId, function (err, news) {
        if (err) {
            console.error(err);
            res.send('Wrong news');
            return
        }

        news = asEntity(news);
        const urlToShare = req.protocol + '://' + req.get('host') + req.originalUrl;
        news.urlTwitter = `https://twitter.com/share?url=${urlToShare}&text=${news.title}`;
        news.urlFacebook = `https://www.facebook.com/sharer/sharer.php?u=${urlToShare}`, "pop", "width=600, height=400, scrollbars=no";

        let previousState = req.cookies[`state_like${newsId}`];
        if (previousState === 'like') news.liked = true;
        else if (previousState === 'dislike') news.disliked = true;

        res.render('detail', news);
    });
});

app.post('/like/:id', function (req, res) {
    likeDislike(true, req, res)
});

app.post('/dislike/:id', function (req, res) {
    likeDislike(false, req, res)
});

function likeDislike(like, req, res) {
    let newsId = req.params.id;
    News.findById(newsId, function (err, news) {
        if (err) {
            console.error(err);
            res.status(500).json({'message': err});
            return
        }

        let previousState = req.cookies[`state_like${newsId}`];

        if (like && previousState !== 'like') {
            let previousValue = news.positiveReviews ? news.positiveReviews : 0;
            news.positiveReviews = previousValue + 1;
            if (previousState === 'dislike') news.negativeReviews = news.negativeReviews - 1;
            res.cookie(`state_like${newsId}`, 'like');
        } else if (!like && previousState !== 'dislike') {
            let previousValue = news.negativeReviews ? news.negativeReviews : 0;
            news.negativeReviews = previousValue + 1;
            if (previousState === 'like') news.positiveReviews = news.positiveReviews - 1;
            res.cookie(`state_like${newsId}`, 'dislike');
        } else {
            res.status(500).json({'message': 'user already performed this action'});
            return
        }

        news.save(function (err, _) {
            if (!err) {
                let index = cachedNews.findIndex((obj => obj.id === news.id));
                if (index !== -1) {
                    cachedNews[index].negativeReviews = news.negativeReviews;
                    cachedNews[index].positiveReviews = news.positiveReviews;
                }

                cachedNews = cachedNews.sort((a, b) => b.positiveReviews - a.positiveReviews);

                res.json({'message': 'success'});
            } else {
                res.status(500).json({'message': err});
            }
        });
    });
}

const port = process.env.PORT || 3000;
app.listen(port, function () {
    console.log(`Running on port ${port}!`);
});