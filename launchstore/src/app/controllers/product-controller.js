const Category = require('../models/category')
const Product = require('../models/product')
const File = require('../models/file')


const { formatPrice, date } = require('../../lib/utils')

module.exports = {
    create(req, res) {
        Category.all().then((results) => {
            const categories = results.rows
            return res.render('products/create.njk', { categories })
        }).catch((err) => {
            throw new Error(err)
        })
    },
    async post(req, res) {
        const keys = Object.keys(req.body)
        for (key of keys) {
            if (req.body[key] == '') {
                return res.send('Please, fill all fields!')
            }
        }

        if (req.files.length == 0)
            return res.send('Please, send at least one image')

        let results = await Product.create(req.body)
        const productId = results.rows[0].id

        const filesPromisse = req.files.map(file => File.create(file.filename, file.path, productId))
        await Promise.all(filesPromisse)


        return res.redirect(`products/${productId}/edit`)
    },
    async show(req, res) {
        let result = await Product.find(req.params.id)
        const product = result.rows[0]

        if (!product) {
            return res.send('Product Not Found!')
        }
        const { day, month, year, hour, minutes } = date(product.updated_at)
        product.published = {
            date: `${day}/${month}/${year}`,
            hour: `${hour}h${minutes}`
        }
        if (product.old_price && product.old_price > product.price)
            product.old_price = formatPrice(product.old_price)
        else
            product.old_price = 0

        result = await Product.files(product.id)
        const files = result.rows.map(file => ({
            ...file,
            src: `${req.protocol}://${req.headers.host}${file.path.replace('public','')}`
        }))

        product.price = formatPrice(product.price)
        return res.render('products/show.njk', { product, files })
    },
    async edit(req, res) {

        let results = await Product.find(req.params.id)
        const product = results.rows[0]
        if (!product)
            return res.send("Product not found!")

        product.price = formatPrice(product.price)
        product.old_price = formatPrice(product.old_price)

        results = await Category.all()
        const categories = results.rows

        results = await Product.files(product.id)
        let files = results.rows
        files = files.map(file => ({
            ...file,
            src: `${req.protocol}://${req.headers.host}${file.path.replace('public','')}`
        }))

        return res.render('products/edit.njk', { product, categories, files })
    },
    async put(req, res) {
        const keys = Object.keys(req.body)
        for (key of keys) {
            if (req.body[key] == '' && key != "removed_files") {
                return res.send('Please, fill all fields!')
            }
        }

        if (req.files.length != 0) {
            const newFilesPromisse = req.files.map(file => File.create(file.filename, file.path, req.body.id))
            await Promise.all(newFilesPromisse)
        }

        if (req.body.removed_files) {
            const removedFiles = req.body.removed_files.split(',')
            const lastIndex = removedFiles.length - 1
            removedFiles.splice(lastIndex, 1)

            const removedFilesPromisse = removedFiles.map(id => File.delete(id))
            await Promise.all(removedFilesPromisse)
        }

        req.body.price = req.body.price.replace(/\D/g, '')
        if (req.body.old_price != req.body.price) {
            const oldProduct = await Product.find(req.body.id)
            req.body.old_price = oldProduct.rows[0].price
        }

        await Product.update(req.body)

        return res.redirect(`/products/${req.body.id}/edit`)
    },
    async delete(req, res) {
        await Product.delete(req.body.id)
        return res.redirect('/')
    }
}